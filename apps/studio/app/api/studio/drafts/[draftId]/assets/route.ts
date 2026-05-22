import { NextResponse } from "next/server";
import { getStudioPersistence } from "@/lib/studio/persistence";
import type { StudioAssetSourceValue } from "@platform/persistence";

export const dynamic = "force-dynamic";

/**
 * GET /api/studio/drafts/[draftId]/assets
 *
 * Lists every asset attached to a draft. Used by the (future M11)
 * asset browser UI.
 *
 * # Query parameters
 *
 *   • `source` — filter by source ("upload" | "scraped" | "generated").
 *
 * # Response (200)
 *
 *   {
 *     assets: [
 *       {
 *         id, draftId, source, bucket, key, contentType, bytes,
 *         width, height, altAr, altEn, createdAt, publicUrl
 *       },
 *       ...
 *     ]
 *   }
 *
 * # Status codes
 *
 *   • 200 OK               → list returned (possibly empty).
 *   • 503 Service Unavail. → DB persistence disabled (file-only mode).
 *
 * # Why 503 instead of 200-with-empty-list when DB is off
 *
 * Returning an empty list would mask a configuration error — the
 * operator thinks "no assets yet" when really nothing has been
 * persisted. 503 + a stable code lets the UI render an
 * "enable persistence to use asset browser" banner.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ draftId: string }> },
) {
  const { draftId } = await ctx.params;

  const persistence = getStudioPersistence();
  if (!persistence.repositories) {
    return NextResponse.json(
      {
        error: "persistence_disabled",
        hint: "set STUDIO_PERSISTENCE_MODE=dual + ADMIN_DATABASE_URL to enable asset browser",
      },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const sourceParam = url.searchParams.get("source");
  const source = isAssetSource(sourceParam) ? sourceParam : undefined;

  const rows = await persistence.repositories.asset.listForDraft({
    draftId,
    source,
  });

  const r2 = persistence.config.r2;
  const assets = rows.map((row) => ({
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
      publicBaseUrl: pickPublicBase(r2, row.r2Bucket),
    }),
  }));

  return NextResponse.json({ assets });
}

function isAssetSource(s: string | null): s is StudioAssetSourceValue {
  return s === "upload" || s === "scraped" || s === "generated";
}

function pickPublicBase(
  r2: { buckets: Record<string, string>; publicBaseUrls: Record<string, string> },
  bucket: string,
): string | undefined {
  for (const [storeId, configured] of Object.entries(r2.buckets)) {
    if (configured === bucket) {
      return r2.publicBaseUrls[storeId];
    }
  }
  return undefined;
}
