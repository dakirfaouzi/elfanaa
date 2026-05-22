import { NextResponse } from "next/server";
import { z } from "zod";
import { getStudioPersistence } from "@/lib/studio/persistence";
import { parseKey } from "@platform/storage";
import { PersistenceError } from "@platform/persistence";

export const dynamic = "force-dynamic";

/**
 * POST /api/studio/drafts/[draftId]/assets/confirm
 *
 * Called by the browser AFTER it has PUT the bytes to R2 via the
 * presigned URL. The endpoint:
 *
 *   1. Validates the key shape (must be under `studio/<draftId>/...`).
 *   2. Verifies the object exists in R2 via `MediaStore.exists`.
 *   3. Creates the `studio_asset` row.
 *   4. Returns the persisted row + a public URL.
 *
 * # Body
 *
 *   {
 *     key: "studio/<draftId>/<source>/<ulid>.<ext>",
 *     bucket: string,
 *     contentType: string,
 *     bytes: number,
 *     altAr?: string,
 *     altEn?: string,
 *     width?: number,
 *     height?: number,
 *   }
 *
 * # Why a separate confirm step
 *
 * The presign step does NOT create an asset row — that prevents
 * orphan rows for failed uploads. Confirm is the single source of
 * truth that bytes exist in R2 AND the operator wants to attach
 * them to the draft.
 *
 * # Idempotency
 *
 * Calling confirm twice with the same `key` returns the existing
 * row (200 with the original `createdAt`). This protects against
 * client retries on flaky networks.
 */
const ConfirmBodySchema = z.object({
  key: z.string().min(1).max(512),
  bucket: z.string().min(1).max(160),
  contentType: z.string().min(1).max(80),
  bytes: z.number().int().positive().max(100 * 1024 * 1024),
  altAr: z.string().max(512).optional(),
  altEn: z.string().max(512).optional(),
  width: z.number().int().positive().max(20_000).optional(),
  height: z.number().int().positive().max(20_000).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ draftId: string }> },
) {
  const { draftId } = await ctx.params;
  const persistence = getStudioPersistence();
  if (!persistence.repositories) {
    return NextResponse.json(
      {
        ok: false,
        code: "mode_unavailable",
        hint:
          "Set STUDIO_PERSISTENCE_MODE=dual + ADMIN_DATABASE_URL to enable asset confirm.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "invalid_input", issues: [{ message: "invalid_json_body" }] },
      { status: 400 },
    );
  }
  const parsed = ConfirmBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_input",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }
  const data = parsed.data;

  // Verify the key belongs to this draft.
  const parsedKey = parseKey(data.key);
  if (!parsedKey) {
    return NextResponse.json(
      { ok: false, code: "invalid_input", issues: [{ path: "key", message: "key_format_invalid" }] },
      { status: 422 },
    );
  }
  if (parsedKey.draftId !== draftId) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_input",
        issues: [{ path: "key", message: "key_draft_mismatch" }],
      },
      { status: 422 },
    );
  }

  // Idempotent — return the existing row if it's already there.
  const existing = await persistence.repositories.asset.findByKey(data.key);
  if (existing) {
    return NextResponse.json({
      ok: true,
      value: assetRowToResponse(existing, persistence),
    });
  }

  // Verify the object actually exists in R2 / memory store. We
  // skip this in development (memory mode) where the test browser
  // PUT lands in the same in-memory store this process owns.
  if (persistence.config.r2.driver === "r2") {
    const exists = await persistence.mediaStore.exists(data.bucket, data.key);
    if (!exists) {
      return NextResponse.json(
        { ok: false, code: "not_found", message: "r2_object_missing" },
        { status: 404 },
      );
    }
  }

  try {
    const row = await persistence.repositories.asset.create({
      draftId,
      source: parsedKey.source,
      bucket: data.bucket,
      key: data.key,
      contentType: data.contentType,
      bytes: data.bytes,
      width: data.width,
      height: data.height,
      altAr: data.altAr,
      altEn: data.altEn,
    });
    await persistence.repositories.event.append({
      draftId,
      kind: "asset.uploaded",
      actor: "studio_ui",
      payload: { assetId: row.id, key: row.r2Key, bytes: row.bytes },
    });
    return NextResponse.json(
      { ok: true, value: assetRowToResponse(row, persistence) },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof PersistenceError && err.kind === "conflict") {
      const existingAfterRace = await persistence.repositories.asset.findByKey(
        data.key,
      );
      if (existingAfterRace) {
        return NextResponse.json({
          ok: true,
          value: assetRowToResponse(existingAfterRace, persistence),
        });
      }
    }
    return NextResponse.json(
      {
        ok: false,
        code: "internal",
        message: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}

function assetRowToResponse(
  row: {
    id: string;
    draftId: string;
    source: string;
    r2Bucket: string;
    r2Key: string;
    contentType: string;
    bytes: number;
    width: number | null;
    height: number | null;
    altAr: string | null;
    altEn: string | null;
    createdAt: Date;
  },
  persistence: ReturnType<typeof getStudioPersistence>,
) {
  const r2 = persistence.config.r2;
  let publicBase: string | undefined;
  for (const [storeId, bucket] of Object.entries(r2.buckets)) {
    if (bucket === row.r2Bucket) {
      publicBase = r2.publicBaseUrls[storeId];
      break;
    }
  }
  return {
    id: row.id,
    draftId: row.draftId,
    source: row.source,
    bucket: row.r2Bucket,
    key: row.r2Key,
    contentType: row.contentType,
    bytes: row.bytes,
    width: row.width,
    height: row.height,
    altAr: row.altAr,
    altEn: row.altEn,
    createdAt: row.createdAt.toISOString(),
    publicUrl: persistence.mediaStore.publicUrl({
      bucket: row.r2Bucket,
      key: row.r2Key,
      publicBaseUrl: publicBase,
    }),
  };
}
