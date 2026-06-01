/**
 * Public-URL resolution for stored media refs — the SINGLE source of truth
 * shared by every surface that turns a persisted image ref into something a
 * browser can fetch (Step 4 Phase 4.5, ADR-S4-3).
 *
 * # Why this exists
 *
 * Before 4.5 the resolution logic was duplicated: the fanaa storefront had
 * `resolveCatalogImageRef` (catalog hydration) and the Studio had
 * `resolveAssetUrl` (preview proxy). They disagreed on edge cases — a bare R2
 * key resolved to the public CDN on fanaa but to a signed proxy URL on Studio,
 * and neither side could answer the one question the publish gate needs:
 * "is this ref durable (our CDN / inline data) or a rotting vendor URL?".
 *
 * This module centralises BOTH:
 *
 *   • `resolveStorageRef` — turn any stored ref into a fetchable absolute URL
 *     (or `null` when unusable). Pure; takes the CDN base as an argument so it
 *     carries no env/runtime coupling and is identical across apps + tests.
 *   • `isDurablePublicUrl` — classify a resolved URL as durable (lives on our
 *     own CDN, or is an inline `data:` URI) vs. foreign/vendor (e.g. a fal CDN
 *     URL that will 404 after the vendor's TTL expires).
 *
 * The publish gate uses both to GUARANTEE we never persist a non-durable hero.
 */

/** Cloudflare R2's PRIVATE S3 API endpoint host suffix (SigV4-only, not browser-fetchable). */
const R2_PRIVATE_ENDPOINT_HOST = /\.r2\.cloudflarestorage\.com$/i;
const R2_PRIVATE_ENDPOINT_ANY = /r2\.cloudflarestorage\.com/i;

/** Strip any trailing slashes so `${base}/${key}` never double-slashes. */
function trimBase(base: string): string {
  return base.replace(/\/+$/, "");
}

/**
 * Resolve the public CDN base from an env value, guarding against the common
 * operator mistake of pointing it at the PRIVATE R2 S3 endpoint (which requires
 * SigV4 auth and is not browser-fetchable). Falls back to the supplied public
 * default when the env is missing or misconfigured.
 *
 * The fallback is a PUBLIC URL, not a credential, so it is safe to default.
 */
export function resolvePublicCdnBase(
  rawEnv: string | undefined | null,
  fallback: string,
): string {
  const env = rawEnv?.trim();
  if (env && !R2_PRIVATE_ENDPOINT_ANY.test(env)) return trimBase(env);
  return trimBase(fallback);
}

/**
 * Rewrite a private R2 S3-endpoint URL to the public CDN URL, or return `null`
 * for any other host (the caller then passes the URL through unchanged).
 *
 * Input:  https://<account>.r2.cloudflarestorage.com/<bucket>/<key...>
 * Output: <cdnBase>/<key...>   (the bucket segment is dropped because the
 *         custom domain is bound to the bucket root).
 */
function rewriteR2EndpointUrl(absoluteUrl: string, cdnBase: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(absoluteUrl);
  } catch {
    return null;
  }
  if (!R2_PRIVATE_ENDPOINT_HOST.test(parsed.hostname)) return null;
  const segments = parsed.pathname.replace(/^\/+/, "").split("/");
  if (segments.length < 2) return null; // need <bucket>/<key>
  const key = segments.slice(1).join("/");
  return key ? `${trimBase(cdnBase)}/${key}` : null;
}

/**
 * Turn whatever is stored in an image ref into a value a browser can render,
 * or `null` when it's unusable. Handles every shape the pipeline can store:
 *
 *   • ""  / whitespace              → null
 *   • inline `data:…`               → as-is (placeholder / data URI)
 *   • absolute `http(s)://…`        → as-is, EXCEPT a private R2 endpoint URL
 *                                     which is rewritten to the public CDN
 *   • `r2://<bucket>/<key>`         → cdnBase + key
 *   • bare key `studio-intake/…png` → cdnBase + key
 *   • any other URI scheme          → null (blob:/file:/ftp:/… unusable here)
 */
export function resolveStorageRef(
  raw: string | null | undefined,
  opts: { cdnBase: string },
): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (value.startsWith("data:")) return value;
  const cdnBase = trimBase(opts.cdnBase);

  if (/^https?:\/\//i.test(value)) {
    return rewriteR2EndpointUrl(value, cdnBase) ?? value;
  }
  if (value.startsWith("r2://")) {
    const withoutScheme = value.slice("r2://".length);
    const firstSlash = withoutScheme.indexOf("/");
    const key = firstSlash >= 0 ? withoutScheme.slice(firstSlash + 1) : "";
    return key ? `${cdnBase}/${key.replace(/^\/+/, "")}` : null;
  }
  // Any other URI scheme we don't understand is unusable. A scheme is
  // letters/digits/+-./ followed by a colon before the first slash; bare R2
  // keys (`studio-intake/fanaa/x.png`) never match this.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  // Bare R2 object key.
  return `${cdnBase}/${value.replace(/^\/+/, "")}`;
}

/**
 * Classify a RESOLVED url (output of `resolveStorageRef`) as durable.
 *
 * Durable = will not rot:
 *   • inline `data:` URI (travels with the payload), or
 *   • lives on our own public CDN base.
 *
 * Anything else — most importantly a vendor image-generation CDN URL (fal,
 * etc.) with a short TTL — is NON-durable and must never be persisted as a
 * product hero. The publish gate uses this to decide whether to re-host or
 * drop the ref.
 */
export function isDurablePublicUrl(
  url: string | null | undefined,
  cdnBase: string,
): boolean {
  if (!url) return false;
  if (url.startsWith("data:")) return true;
  const base = trimBase(cdnBase);
  return url === base || url.startsWith(`${base}/`);
}
