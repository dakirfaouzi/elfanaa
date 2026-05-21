import { NextResponse } from "next/server";
import { prisma, isAdminDbConfigured } from "@/lib/admin/db";
import {
  signAdminToken,
  verifyAdminPassword,
  adminCookieName,
  adminTtlSeconds,
} from "@/lib/admin/auth";
import { adminEnv, isAdminAuthConfigured } from "@/lib/admin/env";
import { getClientIp } from "@/lib/admin/client-ip";
import { fingerprint } from "@/lib/admin/hash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/auth/login
 *
 * Body: { email, password }
 * Sets the admin JWT cookie on success. Throttles slow on failure to nudge
 * brute-force attacks toward unprofitable territory.
 */
export async function POST(req: Request) {
  if (!isAdminAuthConfigured()) {
    return NextResponse.json(
      { error: "admin_not_configured", message: "Set ADMIN_EMAIL, ADMIN_PASSWORD and JWT_SECRET." },
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
  const expectedEmail = adminEnv.adminEmail();

  const emailOk = !!expectedEmail && email === expectedEmail;
  const passwordOk = await verifyAdminPassword(password);
  const ok = emailOk && passwordOk;

  // Audit the attempt (fail-open if DB is down).
  if (isAdminDbConfigured) {
    void prisma.adminAudit
      .create({
        data: {
          email,
          action: ok ? "login_success" : "login_fail",
          ipHash: fingerprint(getClientIp(req.headers)),
          ua: req.headers.get("user-agent")?.slice(0, 255) ?? null,
        },
      })
      .catch(() => undefined);
  }

  if (!ok) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const token = await signAdminToken(email);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: adminCookieName(),
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: adminTtlSeconds,
  });
  return res;
}
