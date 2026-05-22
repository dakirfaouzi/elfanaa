/**
 * Studio base path helper.
 *
 * # Why this file exists
 *
 * Studio is deployed in two layouts:
 *   1. Standalone (dev, EasyPanel-direct, studio subdomain) → mounted at `/`.
 *   2. Behind the storefront at `elfanaa.com/studio` (M12+)   → mounted at
 *      `/studio`.
 *
 * Next.js's built-in `basePath` config auto-prefixes `<Link>`, `useRouter`
 * navigation, image src, and asset URLs. But **raw `fetch()` calls and
 * server-side `redirect()` paths are NOT prefixed automatically** — the
 * runtime treats them as literal URLs. This helper centralises the
 * prefixing so we don't sprinkle conditionals across every component.
 *
 * # One env var to rule them all
 *
 * `NEXT_PUBLIC_STUDIO_BASE_PATH` is consulted in three places:
 *   • `next.config.mjs` reads it at build time to set Next.js `basePath`
 *     + `assetPrefix` (so the static HTML / manifests are baked correctly).
 *   • Server code reads it inside `redirect()` calls and the auth cookie
 *     `path` to keep the cookie scoped to the Studio sub-path.
 *   • Client code imports `studioPath()` from here for every `fetch()`
 *     against an `/api/...` endpoint.
 *
 * The `NEXT_PUBLIC_` prefix means the same value is inlined into the
 * client bundle at build time, so server + client agree on the prefix
 * without any runtime sync.
 *
 * Empty string means "mounted at root" — back-compat with the M2-M11
 * standalone deployment.
 */

/** Compile-time basePath. Empty string when Studio is mounted at `/`. */
export const STUDIO_BASE_PATH: string =
  process.env.NEXT_PUBLIC_STUDIO_BASE_PATH ?? "";

/**
 * Prefix an absolute path with the Studio basePath.
 *
 * Use for:
 *   • client-side `fetch(studioPath("/api/studio/drafts"))`
 *   • server-side `redirect(studioPath("/drafts"))`
 *   • any place where Next.js wouldn't auto-prefix
 *
 * Do NOT use for:
 *   • `<Link href="/drafts">`             — Next.js prefixes automatically.
 *   • `router.push("/drafts")`           — Next.js prefixes automatically.
 *   • `<img src="/some-asset.png">`      — Next.js prefixes via `assetPrefix`.
 */
export function studioPath(p: string): string {
  if (!STUDIO_BASE_PATH) return p;
  const normalised = p.startsWith("/") ? p : `/${p}`;
  return `${STUDIO_BASE_PATH}${normalised}`;
}

/**
 * Cookie scope for Studio auth cookies. Returns the basePath when set,
 * or `/` when the app is mounted at root.
 *
 * Scoping the cookie to the basePath keeps it from leaking to the rest
 * of `elfanaa.com` — defence in depth on top of `HttpOnly` + `Secure`.
 */
export function studioCookiePath(): string {
  return STUDIO_BASE_PATH || "/";
}
