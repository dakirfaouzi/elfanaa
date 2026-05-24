import { NextResponse } from "next/server";
import { presignIntakeAsset } from "@/lib/studio/intake/presign-intake-asset";
import { getStudioPersistence } from "@/lib/studio/persistence";

export const dynamic = "force-dynamic";

/**
 * Structured log emitter for the intake-presign path.
 *
 * # Fields exposed (safe by construction)
 *
 *   tag         — always "intake_presign", for trivial grep / aggregation.
 *   ts          — ISO timestamp.
 *   requestId   — short random id; lets the operator correlate the
 *                 client-side error (the uploader echoes it back to
 *                 the toast in dev) with the server log line.
 *   storeId     — the store the upload is targeting. Not a secret —
 *                 storeIds are publicly enumerable from /studio/intake.
 *   contentType — MIME of the upload. Not a secret.
 *   bytes       — size of the planned upload. Not a secret.
 *   status      — the `result.status` enum returned by presignIntakeAsset.
 *   errorReason — populated only on `presign_failed`; the underlying
 *                 StorageError message (already scrubbed of credentials
 *                 inside the S3 client).
 *   bucketKnown — boolean telling the operator whether the bucket
 *                 resolver returned a value. Critical signal: `false`
 *                 means the env var (R2_BUCKET_FANAA) is missing in
 *                 the runtime env even though the rest of R2 is
 *                 configured — the canonical bucket_missing cause.
 *
 * # Fields deliberately NOT logged
 *
 *   • The signed PUT URL (contains time-limited credentials).
 *   • The R2 access-key / secret-key (never even passed to this log).
 *   • The full request body (could grow to contain operator notes /
 *     future fields that aren't ours to publish to log aggregators).
 *   • The minted R2 key (not strictly sensitive, but unnecessary —
 *     the operator can confirm via the diag endpoint that the
 *     bucket map is populated and the key prefix is correct).
 */
function emitPresignLog(event: {
  requestId: string;
  storeId: string;
  contentType?: string;
  bytes?: number;
  status: string;
  errorReason?: string;
  bucketKnown?: boolean;
}): void {
  if (typeof console === "undefined") return;
  // JSON-stringified so log aggregators (Vector, Loki, Datadog) can
  // parse the line directly without a custom regex. Single-line so
  // `kubectl logs | grep intake_presign` works trivially.
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      tag: "intake_presign",
      ts: new Date().toISOString(),
      ...event,
    }),
  );
}

function newRequestId(): string {
  return Math.random().toString(36).slice(2, 10);
}

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
  const requestId = newRequestId();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    emitPresignLog({ requestId, storeId: "", status: "invalid_json_body" });
    return NextResponse.json(
      { error: "invalid_json_body", requestId },
      { status: 400 },
    );
  }

  // Pull storeId off the body so the bucket lookup is store-scoped.
  // We don't infer it from the JWT because the JWT is operator-
  // identity, not store-identity (an operator could in principle
  // manage multiple stores).
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    emitPresignLog({ requestId, storeId: "", status: "invalid_body_shape" });
    return NextResponse.json(
      { error: "invalid_body_shape", requestId },
      { status: 400 },
    );
  }
  const storeId =
    typeof (body as { storeId?: unknown }).storeId === "string"
      ? ((body as { storeId: string }).storeId)
      : "";
  const reqContentType =
    typeof (body as { contentType?: unknown }).contentType === "string"
      ? ((body as { contentType: string }).contentType)
      : undefined;
  const reqBytes =
    typeof (body as { bytes?: unknown }).bytes === "number"
      ? ((body as { bytes: number }).bytes)
      : undefined;

  const persistence = getStudioPersistence();
  // Re-bundle the intent without storeId so the existing
  // AssetUploadIntentSchema accepts it unchanged. storeId is a
  // route-level concern; the schema deals with upload bytes only.
  const { storeId: _ignored, ...intent } = body as Record<string, unknown>;

  // Snapshot the bucket-resolution outcome BEFORE the presign call so
  // we can log it even on success. This is the single most useful
  // signal when triaging upload failures — `bucketKnown=false` plus
  // `status=bucket_missing` immediately points the operator at the
  // R2_BUCKET_FANAA env var, no source-diving required.
  const resolvedBucket = persistence.config.r2.buckets[storeId];
  const bucketKnown = Boolean(resolvedBucket);

  const result = await presignIntakeAsset({
    storeId,
    rawIntent: intent,
    mediaStore: persistence.mediaStore,
    bucketResolver: (id) => persistence.config.r2.buckets[id],
  });

  switch (result.status) {
    case "ok":
      emitPresignLog({
        requestId,
        storeId,
        contentType: reqContentType,
        bytes: reqBytes,
        status: "ok",
        bucketKnown,
      });
      return NextResponse.json({
        intent: result.intent,
        presigned: result.presigned,
        requestId,
      });
    case "invalid_intent":
      emitPresignLog({
        requestId,
        storeId,
        contentType: reqContentType,
        bytes: reqBytes,
        status: "invalid_intent",
        bucketKnown,
      });
      return NextResponse.json(
        { error: "validation_failed", issues: result.issues, requestId },
        { status: 422 },
      );
    case "invalid_store":
      emitPresignLog({
        requestId,
        storeId,
        contentType: reqContentType,
        bytes: reqBytes,
        status: "invalid_store",
        bucketKnown: false,
      });
      return NextResponse.json(
        { error: "invalid_store_id", storeId: result.storeId, requestId },
        { status: 400 },
      );
    case "bucket_missing":
      // This is the case operators historically struggled with — log
      // it loudly with the storeId so the EasyPanel log search trivially
      // surfaces "bucketKnown:false storeId:fanaa" → the env var fix
      // (R2_BUCKET_FANAA) becomes obvious.
      emitPresignLog({
        requestId,
        storeId,
        contentType: reqContentType,
        bytes: reqBytes,
        status: "bucket_missing",
        bucketKnown: false,
      });
      return NextResponse.json(
        { error: "bucket_missing", storeId: result.storeId, requestId },
        { status: 503 },
      );
    case "presign_failed":
      emitPresignLog({
        requestId,
        storeId,
        contentType: reqContentType,
        bytes: reqBytes,
        status: "presign_failed",
        // The reason comes from the storage layer's error message,
        // which is sanitised inside MediaStore (no credentials leak).
        errorReason: result.reason,
        bucketKnown,
      });
      return NextResponse.json(
        { error: "presign_failed", reason: result.reason, requestId },
        { status: 502 },
      );
  }
}
