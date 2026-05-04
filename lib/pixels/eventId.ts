/**
 * Event ID generation — the one knob that makes browser + server CAPI
 * deduplicate into a single conversion.
 *
 * Rule: every commerce event sent from the browser MUST carry an
 * `event_id`. When the same event is also fired server-side (via
 * `backend/app/services/pixels/`), it MUST reuse the exact same id.
 * Meta / TikTok / Snapchat all use this for de-dup.
 *
 * For the post-purchase Purchase event, the storefront mints the id at
 * checkout-submit time, posts it to `/orders` (so the backend echoes it
 * to the CAPIs), and re-uses it when the browser pixel fires `Purchase`
 * on the thank-you page.
 */

const RAND_LEN = 10;

export function newEventId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? Array.from(crypto.getRandomValues(new Uint8Array(RAND_LEN)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
          .slice(0, RAND_LEN)
      : Math.random().toString(36).slice(2, 2 + RAND_LEN);
  return `${prefix}_${ts}_${rand}`;
}

/**
 * Read browser-pixel attribution cookies that platforms drop themselves.
 * These travel server-side as un-hashed values for cross-device match-back.
 */
export function readAttributionCookies(): {
  fbp?: string;
  fbc?: string;
  ttp?: string;
  scClickId?: string;
} {
  if (typeof document === "undefined") return {};
  const out: Record<string, string> = {};
  for (const part of document.cookie.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    if (!rawKey) continue;
    const key = rawKey.trim();
    const value = rest.join("=").trim();
    if (!value) continue;
    if (key === "_fbp") out.fbp = value;
    if (key === "_fbc") out.fbc = value;
    if (key === "_ttp") out.ttp = value;
    if (key === "_scid") out.scClickId = value;
  }
  return out;
}
