import { createHmac, timingSafeEqual } from "crypto";

/**
 * HMAC-SHA256 signing for outbound webhooks. Receivers can verify with the
 * shared secret in `WEBHOOK_SECRET`. Includes a timestamp to mitigate replay.
 */
export function signPayload(payload: string, secret: string, ts: number): string {
  return createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
}

export function verifySignature(
  payload: string,
  secret: string,
  ts: number,
  signature: string,
  toleranceSec = 300
): boolean {
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;
  const expected = signPayload(payload, secret, ts);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
