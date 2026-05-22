import { NextResponse } from "next/server";
import {
  signStudioToken,
  studioCookieName,
  studioTokenTtlSeconds,
} from "@/lib/auth/tokens";
import { verifyStudioPassword } from "@/lib/auth/password";
import { studioEnv, isStudioAuthConfigured } from "@/lib/auth/env";
import { studioCookiePath } from "@/lib/base-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 *
 * Body: { email: string, password: string }
 *
 * Returns:
 *   • 200 { ok: true }                  — sets _fa_studio HttpOnly cookie
 *   • 400 { error: "invalid_json" }     — body parse fail
 *   • 401 { error: "invalid_credentials" } — email + password mismatch
 *   • 503 { error: "studio_not_configured", message }
 *           — STUDIO_EMAIL / STUDIO_PASSWORD[_HASH] / STUDIO_JWT_SECRET missing
 *
 * On failure, intentionally sleeps ~600ms before responding to make
 * credential brute-force unprofitable on the slow side. The legitimate
 * login latency is dominated by bcrypt anyway so this isn't visible to
 * real users.
 */
export async function POST(req: Request) {
  if (!isStudioAuthConfigured()) {
    return NextResponse.json(
      {
        error: "studio_not_configured",
        message:
          "Set STUDIO_EMAIL, STUDIO_PASSWORD (or STUDIO_PASSWORD_HASH), and STUDIO_JWT_SECRET in the Studio container environment.",
      },
      { status: 503 }
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const expectedEmail = studioEnv.studioEmail();

  // Verify email + password in parallel — bcrypt is the expensive leg, and
  // we want both checks to complete regardless of which fails so a timing
  // attack can't differentiate "wrong email" from "wrong password".
  const emailOk = !!expectedEmail && email === expectedEmail;
  const passwordOk = await verifyStudioPassword(password);
  const ok = emailOk && passwordOk;

  if (!ok) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const token = await signStudioToken(email);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: studioCookieName(),
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // Scope the cookie to the Studio sub-path so it never leaves the
    // mounted area (no leakage to the storefront when both share a
    // domain like `elfanaa.com`). Defaults to `/` for the root-mounted
    // standalone deployment.
    path: studioCookiePath(),
    maxAge: studioTokenTtlSeconds,
  });
  return res;
}
