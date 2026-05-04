import { NextResponse } from "next/server";
import { verifySignature } from "@/lib/webhooks/verify";
import {
  WEBHOOK_HEADER_SIGNATURE,
  WEBHOOK_HEADER_TIMESTAMP,
} from "@/lib/brand";

/**
 * Inbound webhook receiver.
 *
 * Routes by provider segment (e.g. /api/webhooks/shipping, /api/webhooks/crm).
 * Verifies HMAC-SHA256 signature using the shared `WEBHOOK_SECRET`. The
 * timestamp + signature contract intentionally mirrors what we emit, so a
 * partner running the same library can talk to us out of the box.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "webhooks_disabled" }, { status: 503 });
  }

  const ts = Number(req.headers.get(WEBHOOK_HEADER_TIMESTAMP));
  const sig = req.headers.get(WEBHOOK_HEADER_SIGNATURE);
  const raw = await req.text();

  if (!ts || !sig || !verifySignature(raw, secret, ts, sig)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Hand off to provider-specific handlers. Keep this switch tiny — handlers
  // belong in /lib/webhooks/handlers/<provider>.ts as your integrations grow.
  switch (provider) {
    case "shipping":
    case "crm":
    case "payments":
      // TODO: dispatch to handler module.
      console.info(`[webhook:${provider}]`, payload);
      return NextResponse.json({ ok: true });
    default:
      return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  }
}
