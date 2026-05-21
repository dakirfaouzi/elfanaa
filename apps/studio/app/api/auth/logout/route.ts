import { NextResponse } from "next/server";
import { studioCookieName } from "@/lib/auth/tokens";

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
    path: "/",
    maxAge: 0,
  });
  return res;
}
