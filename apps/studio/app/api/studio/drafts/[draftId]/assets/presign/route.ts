import { NextResponse } from "next/server";
import { presignAsset } from "@/lib/studio/asset-presign";
import { getStudioPersistence } from "@/lib/studio/persistence";

export const dynamic = "force-dynamic";

/**
 * POST /api/studio/drafts/[draftId]/assets/presign
 *
 * Mints a presigned PUT URL for a single asset upload.
 *
 * # Request body
 *
 *   {
 *     source: "upload" | "scraped" | "generated",
 *     contentType: "image/png" | "image/jpeg" | "image/webp" | ...,
 *     bytes: number,            // ≤ 25 MiB
 *     altAr?: string,
 *     altEn?: string,
 *   }
 *
 * # Response (200)
 *
 *   {
 *     intent: { ... },          // echoed back for client correlation
 *     presigned: {
 *       url: "https://...",     // browser PUTs here
 *       headers: { ... },       // browser MUST include verbatim
 *       method: "PUT",
 *       expiresAt: ISO-8601,
 *       ref: { bucket, key, contentType, bytes },
 *     }
 *   }
 *
 * # Status codes
 *
 *   • 200 OK              → presign minted.
 *   • 400 Bad Request     → invalid JSON body.
 *   • 404 Not Found       → draft missing (when DB persistence enabled).
 *   • 422 Unprocess.      → schema validation failed.
 *   • 502 Bad Gateway     → MediaStore failure.
 *
 * # M10 scope notes
 *
 *   • The presign endpoint does NOT create a `studio_asset` row.
 *     The browser must complete the PUT first, then a future
 *     /confirm endpoint (M11) materialises the row.
 *   • The endpoint is JWT-gated by the Studio root middleware.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ draftId: string }> },
) {
  const { draftId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json_body" },
      { status: 400 },
    );
  }

  const persistence = getStudioPersistence();
  const result = await presignAsset({
    draftId,
    rawIntent: body,
    mediaStore: persistence.mediaStore,
    draftRepo: persistence.repositories?.draft,
    bucketResolver: (storeId) => persistence.config.r2.buckets[storeId],
  });

  switch (result.status) {
    case "ok":
      return NextResponse.json({
        intent: result.intent,
        presigned: result.presigned,
      });
    case "invalid_intent":
      return NextResponse.json(
        { error: "validation_failed", issues: result.issues },
        { status: 422 },
      );
    case "draft_not_found":
      return NextResponse.json(
        { error: "draft_not_found", draftId: result.draftId },
        { status: 404 },
      );
    case "bucket_missing":
      return NextResponse.json(
        { error: "bucket_missing", storeId: result.storeId },
        { status: 503 },
      );
    case "presign_failed":
      return NextResponse.json(
        { error: "presign_failed", reason: result.reason },
        { status: 502 },
      );
  }
}
