import { NextResponse } from "next/server";
import { studioCookieName } from "@/lib/auth/tokens";
import { studioCookiePath } from "@/lib/base-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout
 *
 * Clears the Studio session cookie. Always returns 200 — there is no
 * "you were never logged in" failure mode for a logout. Idempotent.
 *
 * Intentionally a POST (not GET) so a malicious image or link from
 * outside the Studio domain can't silently sign the operator out via
 * a forged GET. CSRF tokens aren't needed because the cookie is
 * SameSite=Lax and the route doesn't read body content.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: studioCookieName(),
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // Must match the path used at login for the browser to actually
    // clear the cookie — otherwise the new empty cookie sits next to
    // the old one and the session looks "stuck".
    path: studioCookiePath(),
    maxAge: 0,
  });
  return res;
}
