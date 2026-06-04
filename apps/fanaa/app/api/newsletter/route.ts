import { NextResponse } from "next/server";
import { subscribe } from "@/lib/newsletter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/newsletter — capture a footer newsletter signup.
 *
 * Body: `{ email: string, company?: string }`.
 *   • `company` is a honeypot — bots fill it, humans never see it. A non-empty
 *     value is silently accepted (and dropped) so bots get no signal.
 *
 * Responses:
 *   200 `{ ok: true }`              — captured (or gracefully skipped if no
 *                                     provider env is configured).
 *   422 `{ ok: false, error }`      — invalid email.
 *   502 `{ ok: false, error }`      — provider failed.
 */
export async function POST(req: Request) {
  let body: { email?: unknown; company?: unknown };
  try {
    body = (await req.json()) as { email?: unknown; company?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // Honeypot — drop bot submissions without leaking that we did.
  if (typeof body.company === "string" && body.company.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const result = await subscribe(email, "footer");

  if (!result.ok) {
    const status = result.error === "invalid_email" ? 422 : 502;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json({ ok: true });
}
