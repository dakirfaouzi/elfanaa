/**
 * Client-side API base resolver.
 *
 * Two deployment modes are supported:
 *
 *   • **Standalone**: leave `NEXT_PUBLIC_API_BASE_URL` blank. The
 *     storefront posts orders to its own Next.js routes (`/api/orders`,
 *     `/api/orders/:id/upsell`). Useful in development, in single-region
 *     all-on-Vercel deploys, and as a fallback when the Python backend
 *     is unreachable.
 *
 *   • **Two-tier (recommended for production)**: set
 *     `NEXT_PUBLIC_API_BASE_URL=https://api.elfanaa.com`. The storefront
 *     posts directly to the FastAPI service so orders persist to
 *     Postgres, the Pixel CAPIs fire from the server, and the Google
 *     Sheets dashboard updates.
 *
 * Path mapping is identical across modes:
 *   • POST /orders                 (or /api/orders in standalone mode)
 *   • POST /orders/:id/upsell/accept
 *
 * The Next.js routes accept the same JSON body shape as FastAPI (camelCase
 * via Pydantic alias generators) so you can switch modes by flipping a
 * single env var, no code changes required.
 */

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  // FastAPI mounts paths at the root (`/orders`); the Next.js routes
  // mount under `/api/orders`. Translate transparently.
  if (base) {
    const normalised = path.startsWith("/api") ? path.slice(4) : path;
    return `${base}${normalised.startsWith("/") ? "" : "/"}${normalised}`;
  }
  warnOnceIfMisconfigured(path);
  return path;
}

/**
 * Resolved `NEXT_PUBLIC_API_BASE_URL`, trimmed of trailing slashes.
 * Returns `""` when standalone (Next.js fallback) mode is active.
 *
 * Exposed so the diagnostics endpoint and tests can assert which mode
 * the build was compiled in, without parsing `apiUrl()`'s output.
 */
export function getApiBaseUrl(): string {
  // Strip any number of trailing slashes so `https://api.elfanaa.com//`
  // and `https://api.elfanaa.com/` both produce a clean base.
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
}

/**
 * True when `NEXT_PUBLIC_API_BASE_URL` was inlined into this build,
 * i.e. the storefront posts directly to the FastAPI backend.
 */
export function isTwoTier(): boolean {
  return Boolean(getApiBaseUrl());
}

// ── Runtime sanity check ────────────────────────────────────────────────────
// In production the storefront SHOULD be two-tier: orders / upsells / geo
// flow to the FastAPI service where Sheets dispatch, pixel CAPI, MaxMind,
// and Postgres all live. If `NEXT_PUBLIC_API_BASE_URL` is empty in a
// production browser the bundle was compiled without the build ARG (see
// the Dockerfile builder stage) — that's a deployment misconfiguration
// that silently sends every order to the embedded fallback route.
//
// We emit a single console warning per page-load so a developer or QA
// hitting devtools sees it immediately. Suppressed in dev (the standalone
// mode is the expected local-dev path).
let warnedOnce = false;
function warnOnceIfMisconfigured(samplePath: string): void {
  if (warnedOnce) return;
  if (typeof window === "undefined") return; // SSR — too noisy, no value
  if (process.env.NODE_ENV !== "production") return; // dev fallback is fine
  warnedOnce = true;
  console.warn(
    "[apiUrl] NEXT_PUBLIC_API_BASE_URL is empty in this build. " +
      "Storefront requests like `" +
      samplePath +
      "` are hitting the embedded Next.js fallback instead of the " +
      "FastAPI backend. Set NEXT_PUBLIC_API_BASE_URL as a BUILD " +
      "argument (not a runtime env var — it's inlined by Webpack at " +
      "build time) and redeploy. See the frontend Dockerfile builder " +
      "stage and docker-compose.yml `elfanaa_web.build.args`."
  );
}
