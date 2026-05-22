import { NextResponse } from "next/server";
import { z } from "zod";
import { getStudioPersistence } from "@/lib/studio/persistence";

export const dynamic = "force-dynamic";

/**
 * GET /api/studio/assets
 *
 * Cross-draft asset browser data source. Lists every asset across
 * every draft, paginated by `createdAt DESC`. Used by the
 * `/assets` page in the Studio UI.
 *
 * # Query parameters
 *
 *   • `contentTypePrefix` — e.g. `image/`, `video/`.
 *   • `take`              — page size (max 200, default 60).
 *   • `cursor`            — ISO timestamp of the last row from the
 *                           previous page. The next page returns
 *                           assets strictly older than this.
 *
 * # Response (200)
 *
 *   {
 *     ok: true,
 *     value: {
 *       assets: [...],
 *       nextCursor: string | null,     // when omitted, no more pages
 *     }
 *   }
 *
 * # Response (503) when DB persistence disabled.
 */

const QuerySchema = z.object({
  contentTypePrefix: z.string().max(40).optional(),
  take: z.coerce.number().int().min(1).max(200).default(60),
  cursor: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const persistence = getStudioPersistence();
  if (!persistence.repositories) {
    return NextResponse.json(
      {
        ok: false,
        code: "mode_unavailable",
        hint:
          "Set STUDIO_PERSISTENCE_MODE=dual + ADMIN_DATABASE_URL to enable the asset browser.",
      },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    contentTypePrefix: url.searchParams.get("contentTypePrefix") ?? undefined,
    take: url.searchParams.get("take") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
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
  const q = parsed.data;
  const rows = await persistence.repositories.asset.listAll({
    contentTypePrefix: q.contentTypePrefix,
    take: q.take,
    cursorCreatedAt: q.cursor ? new Date(q.cursor) : undefined,
  });

  const r2 = persistence.config.r2;
  const assets = rows.map((row) => {
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
  });

  const nextCursor =
    rows.length === q.take ? rows[rows.length - 1]!.createdAt.toISOString() : null;

  return NextResponse.json({
    ok: true,
    value: { assets, nextCursor },
  });
}
