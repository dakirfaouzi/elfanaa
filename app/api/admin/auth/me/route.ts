import { NextResponse } from "next/server";
import { adminCookieName, verifyAdminToken } from "@/lib/admin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${escape(adminCookieName())}=([^;]+)`));
  const token = match ? decodeURIComponent(match[1]) : null;
  if (!token) return NextResponse.json({ authenticated: false }, { status: 401 });
  const claims = await verifyAdminToken(token);
  if (!claims) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, email: claims.sub });
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
