import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Studio root middleware.
 *
 * Responsibilities:
 *   1. Gate EVERYTHING in this app behind a valid Studio JWT cookie. Unlike
 *      Fanaa where only `/admin/*` is gated and the storefront is public,
 *      Studio is an internal-only tool — there is no public surface.
 *   2. Allow exactly two public paths:
 *        • /login                  (UI)
 *        • /api/auth/login         (POST credentials)
 *        • /api/auth/logout        (POST clear cookie — safe to be public,
 *                                   no-op if unauthenticated)
 *   3. Redirect unauthenticated browser hits to /login (preserving `next`).
 *   4. Return JSON 401 for unauthenticated API hits — never an HTML redirect.
 *
 * The middleware runs on the Edge runtime, so we use `jose` (Edge-compatible)
 * rather than node:crypto for verification.
 *
 * NOTE: Studio JWT secret is STUDIO_JWT_SECRET, NOT the shared JWT_SECRET
 * used by Fanaa admin. The two are deliberately decoupled so revocation
 * of one doesn't cascade to the other. See lib/auth/env.ts.
 */

const COOKIE_NAME = process.env.STUDIO_AUTH_COOKIE || "_fa_studio";

const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static assets bypass — Next.js already excludes these via the `matcher`
  // below, but the early-return here is cheaper than evaluating the cookie
  // check on every static fetch during dev.
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const secret = process.env.STUDIO_JWT_SECRET;
  let valid = false;
  if (token && secret) {
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(secret),
        { algorithms: ["HS256"] }
      );
      valid = payload.role === "studio" && typeof payload.sub === "string";
    } catch {
      valid = false;
    }
  }

  if (valid) return NextResponse.next();

  // Differentiate API vs UI for the unauthenticated case:
  //   • API → JSON 401 so a fetch() can detect + handle re-auth.
  //   • UI  → 302 to /login with the original path preserved as `next`.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Clone `req.nextUrl` (rather than `new URL(..., req.url)`) so the
  // basePath stays intact in the Location header — when Studio is mounted
  // at `/studio`, the redirect must land on `/studio/login`, not `/login`.
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on every path EXCEPT Next.js internals + the favicon. The exclusion
  // list mirrors Next.js's recommended catch-all matcher; everything inside
  // the matched space is then explicitly allowlisted by PUBLIC_PATHS above.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
