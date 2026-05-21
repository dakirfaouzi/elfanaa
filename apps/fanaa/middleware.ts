import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Root middleware.
 *
 * Responsibilities:
 *   1. Gate everything under `/admin/*` and `/api/admin/*` behind a valid JWT
 *      session cookie. Storefront, checkout, Sheets webhook, and pixels are
 *      explicitly NOT touched.
 *   2. Redirect unauthenticated UI hits to /admin/login (preserving `next`).
 *   3. Return JSON 401 for unauthenticated API hits — never an HTML redirect.
 *
 * The middleware runs on the Edge runtime, so we use `jose` (Edge-compatible)
 * rather than node:crypto for verification.
 */

const COOKIE_NAME = process.env.ADMIN_AUTH_COOKIE || "_fa_admin";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public admin routes:
  //   • /admin/login                       (UI)
  //   • /api/admin/auth/*                  (login / logout / me)
  //   • /api/admin/ingest/*                (HMAC-signed; auth via WEBHOOK_SECRET)
  if (
    pathname === "/admin/login" ||
    pathname.startsWith("/api/admin/auth/") ||
    pathname.startsWith("/api/admin/ingest/")
  ) {
    return NextResponse.next();
  }

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  if (!isAdminPage && !isAdminApi) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  let valid = false;
  if (token && secret) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
        algorithms: ["HS256"],
      });
      valid = payload.role === "admin" && typeof payload.sub === "string";
    } catch {
      valid = false;
    }
  }

  if (valid) return NextResponse.next();

  if (isAdminApi) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/admin/login", req.url);
  loginUrl.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Match only admin surfaces. Everything else (storefront, /api/orders,
  // /api/track, /api/webhooks/*, /api/diagnostics/*, images, assets) is
  // explicitly excluded.
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
