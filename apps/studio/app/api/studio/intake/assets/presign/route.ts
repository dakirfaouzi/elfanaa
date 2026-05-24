import { NextResponse } from "next/server";
import { presignIntakeAsset } from "@/lib/studio/intake/presign-intake-asset";
import { getStudioPersistence } from "@/lib/studio/persistence";

export const dynamic = "force-dynamic";

/**
 * POST /api/studio/intake/assets/presign
 *
 * Mints a presigned PUT URL for an intake-time asset upload.
 * Used by the IntakeForm's `<ImageUploader>` to upload supplier
 * images BEFORE a `studio_draft` row exists.
 *
 * # Why this lives next to /intake instead of /drafts/[id]/assets
 *
 * The intake page's image uploader fires before a draft exists.
 * The existing `/api/studio/drafts/[draftId]/assets/presign` route
 * requires a `draftId`. This route is its intake-time sibling —
 * same JSON contract, no draft required, writes to the
 * `studio-intake/<storeId>/` key prefix (which an R2 lifecycle
 * rule expires after 24h to GC uncommitted uploads).
 *
 * # Request body
 *
 *   {
 *     storeId: "fanaa",
 *     source: "upload" | "scraped" | "generated",  // always "upload" today
 *     contentType: "image/png" | "image/jpeg" | ... ,
 *     bytes: number,            // ≤ 50 MiB (storage schema cap)
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
 *       ref: {
 *         bucket: "fanaa-assets",
 *         key: "studio-intake/fanaa/01HZ.../...webp",
 *         contentType: "image/webp",
 *         bytes: 12345,
 *       },
 *     }
 *   }
 *
 * The browser then PUTs the file at `presigned.url` and stores
 * `presigned.ref.key` in its local list. On form submit, the key
 * is sent as `uploadedImages[].src` — identical contract to the
 * pre-Phase-B textarea flow.
 *
 * # Status codes
 *
 *   • 200 OK              → presign minted.
 *   • 400 Bad Request     → invalid JSON body OR storeId missing/invalid.
 *   • 422 Unprocess.      → schema validation failed on intent body.
 *   • 502 Bad Gateway     → MediaStore failure.
 *   • 503 Service Unavail.→ no bucket configured for the store.
 *
 * # Operator note — R2 lifecycle config
 *
 * For the cleanup-on-orphan story to work end-to-end, the R2
 * bucket (e.g. `fanaa-assets`) MUST have a lifecycle rule:
 *
 *     prefix:  studio-intake/
 *     action:  Expiration
 *     days:    1
 *
 * Without the rule, orphan intake uploads accumulate forever.
 * With it, R2 auto-deletes any object under `studio-intake/`
 * older than 24h.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json_body" },
      { status: 400 },
    );
  }

  // Pull storeId off the body so the bucket lookup is store-scoped.
  // We don't infer it from the JWT because the JWT is operator-
  // identity, not store-identity (an operator could in principle
  // manage multiple stores).
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "invalid_body_shape" },
      { status: 400 },
    );
  }
  const storeId =
    typeof (body as { storeId?: unknown }).storeId === "string"
      ? ((body as { storeId: string }).storeId)
      : "";

  const persistence = getStudioPersistence();
  // Re-bundle the intent without storeId so the existing
  // AssetUploadIntentSchema accepts it unchanged. storeId is a
  // route-level concern; the schema deals with upload bytes only.
  const { storeId: _ignored, ...intent } = body as Record<string, unknown>;

  const result = await presignIntakeAsset({
    storeId,
    rawIntent: intent,
    mediaStore: persistence.mediaStore,
    bucketResolver: (id) => persistence.config.r2.buckets[id],
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
    case "invalid_store":
      return NextResponse.json(
        { error: "invalid_store_id", storeId: result.storeId },
        { status: 400 },
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
