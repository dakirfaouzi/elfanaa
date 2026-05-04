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
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  // FastAPI mounts paths at the root (`/orders`); the Next.js routes
  // mount under `/api/orders`. Translate transparently.
  if (base) {
    const normalised = path.startsWith("/api") ? path.slice(4) : path;
    return `${base}${normalised.startsWith("/") ? "" : "/"}${normalised}`;
  }
  return path;
}
