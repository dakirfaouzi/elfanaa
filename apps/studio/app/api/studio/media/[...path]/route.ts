import { NextResponse } from "next/server";
import { fanaaStore } from "@platform/stores";
import { parseIntakeKey, parseKey } from "@platform/storage";
import {
  getStudioPersistence,
  type StudioPersistence,
} from "@/lib/studio/persistence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/studio/media/[...path]
 *
 * R2 asset proxy. Translates an `<img src="/api/studio/media/<key>">`
 * request into a 302 redirect to a short-lived signed R2 GET URL.
 *
 * # Why this route exists (C3.1 follow-up)
 *
 * The intake uploader PUTs bytes to R2 via a presigned URL, then stores
 * the R2 KEY (e.g. `studio-intake/fanaa/<ULID>.webp`) directly in
 * `IngestJob.uploadedImages[].src`. That key flows verbatim through the
 * AI pipeline, the product-to-draft mapper, and the publish snapshot,
 * landing inside every `MediaRef.desktopSrc` of the rendered document.
 *
 * The runtime renderer (`@platform/runtime-renderer/<Media>`) writes
 * whatever value sits in `desktopSrc` straight into `<img src>`. Without
 * a CDN base configured, `studio-intake/fanaa/<ulid>.webp` becomes a
 * relative URL on the Studio host (404). That manifests as:
 *
 *   • catalog cards stuck on "ASSET PENDING"
 *   • storefront pages with broken hero + gallery images, leaving the
 *     page looking "collapsed" because the `<img>` aspect-ratio CSS
 *     reserves space the asset never fills
 *
 * This route closes the loop: the `resolveAssetUrl()` helper rewrites
 * keys to `/api/studio/media/<encoded-key>`; this handler validates the
 * key, mints a presigned R2 GET URL, and 302-redirects the browser
 * straight to R2.
 *
 * # Trust model
 *
 * The Studio root middleware gates this route with the operator JWT,
 * identical to every other `/api/studio/*` endpoint. Anonymous traffic
 * receives a JSON 401 from the middleware before this handler runs.
 *
 * # Accepted key shapes
 *
 *   • `studio-intake/<storeId>/<ULID>.<ext>` — intake uploads. Store
 *     resolved from the key prefix.
 *   • `studio/<draftId>/<source>/<ULID>.<ext>` — draft-attached uploads.
 *     Store defaults to fanaa (single-tenant today; multi-store wiring
 *     deferred until a second store comes online — at that point we
 *     extend this to look up `studio_asset.r2Bucket` via the draftId).
 *
 * Anything else returns 404 — we never proxy arbitrary user-supplied
 * keys, defence-in-depth against SSRF-style abuse.
 *
 * # Why 302 (instead of streaming)
 *
 * The 302 keeps Studio out of the bandwidth path. R2 serves the bytes
 * with its own CDN behaviour; our box just signs a 5-minute URL.
 *
 * # Cache behaviour
 *
 * `Cache-Control: private, max-age=60` on the redirect. Shorter than the
 * 300s presign TTL so we never hand out an expired Location, longer
 * than the typical SPA-navigation re-render so the same `<img>` doesn't
 * re-sign on every interaction. The actual bytes are cached by the
 * browser per R2's response headers (set at upload time).
 *
 * # Failure modes
 *
 *   • 400 missing_key       — empty catch-all.
 *   • 404 invalid_key_shape — key didn't match either accepted format.
 *   • 503 bucket_missing    — env var not configured for the store
 *                              (same signal the presign route emits).
 *   • 502 presign_failed    — the MediaStore raised an error.
 *   • 502 driver_unsupported — running in memory mode (dev only); the
 *                              proxy expects R2 mode for browser-fetchable
 *                              redirects. Memory mode is for tests only.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const params = await ctx.params;
  const segments = params.path ?? [];
  if (segments.length === 0) {
    return jsonError("missing_key", 400);
  }
  // The proxy URL encodes each segment with encodeURIComponent (see
  // `resolveAssetUrl()`). Reverse the encoding here so we reconstruct
  // the original R2 key byte-for-byte.
  let key: string;
  try {
    key = segments.map((s) => decodeURIComponent(s)).join("/");
  } catch {
    return jsonError("invalid_key_encoding", 400);
  }
  if (key.length === 0 || key.length > 512) {
    return jsonError("invalid_key", 400);
  }

  // Validate the key shape. We accept only the two issued formats to
  // prevent the proxy from being a generic R2 read endpoint for any
  // arbitrary key a caller might construct.
  let storeId: string | null = null;
  const intakeParsed = parseIntakeKey(key);
  if (intakeParsed) {
    storeId = intakeParsed.storeId;
  } else if (parseKey(key)) {
    // Draft-attached key. Single-tenant fallback until multi-store is
    // wired (see the file-level comment).
    storeId = fanaaStore.id;
  } else {
    return jsonError("invalid_key_shape", 404);
  }

  const persistence = getStudioPersistence();
  const bucket = persistence.config.r2.buckets[storeId];
  if (!bucket) {
    return jsonError("bucket_missing", 503);
  }

  // Memory mode emits `memory://media/...` URLs — browsers can't fetch
  // those. We surface that explicitly so the operator sees the real
  // root cause instead of a silently-broken image. Production runs in
  // R2 mode where the signed URL is a real HTTPS endpoint.
  if (persistence.config.r2.driver !== "r2") {
    return tryMemoryProxy(persistence, bucket, key);
  }

  try {
    const presigned = await persistence.mediaStore.presignDownload({
      bucket,
      key,
      expiresInSec: 300,
    });
    const response = NextResponse.redirect(presigned.url, 302);
    response.headers.set("Cache-Control", "private, max-age=60");
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return jsonError(`presign_failed:${message}`, 502);
  }
}

/**
 * Memory-mode fallback. In dev/test the MediaStore is in-process and
 * we don't have a public URL to redirect to — return a JSON-shaped
 * 502 so the failure is obvious in the network panel instead of a
 * silently-broken image.
 *
 * This is intentionally NOT a "stream bytes" implementation: the
 * MemoryMediaStore contract doesn't expose `getBytes`, and the
 * existing local-upload route under `/api/studio/uploads/local`
 * handles the dev `PUT` path. A future expansion can add a GET
 * handler there if local end-to-end image rendering becomes
 * necessary.
 */
function tryMemoryProxy(
  _persistence: StudioPersistence,
  bucket: string,
  key: string,
): NextResponse {
  return NextResponse.json(
    {
      error: "driver_unsupported_for_proxy",
      hint:
        "Set STORAGE_DRIVER=r2 with valid R2_* credentials so the asset proxy can mint signed GET URLs.",
      bucket,
      key,
    },
    { status: 502 },
  );
}

function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}
