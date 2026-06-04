/**
 * Newsletter subscription — provider seam.
 *
 * Phase-1 default: capture subscribers to a dedicated Google Sheet via a
 * separate Apps Script web app (`NEWSLETTER_SHEETS_WEBHOOK_URL`), mirroring the
 * graceful-skip behaviour of the orders dispatcher in
 * `lib/webhooks/google-sheets.ts`. When the env var is unset the call is a
 * clean no-op success, so the footer form keeps working in any environment.
 *
 * ESP-swappable by design: to move to Klaviyo / Mailchimp / Resend later, add a
 * provider function with the same `NewsletterProvider` signature and point
 * `activeProvider` at it. Nothing else (route, UI) needs to change.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SubscribeResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; error: "invalid_email" | "provider_error" };

type NewsletterProvider = (email: string, source: string) => Promise<SubscribeResult>;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 254;
}

/**
 * Default provider — appends a `{ kind: "subscriber" }` row to the newsletter
 * Google Sheet. Apps Script can't read custom headers, so the shared secret
 * rides as a `?apiKey=` query param (same contract as the orders webhook).
 */
const sheetsProvider: NewsletterProvider = async (email, source) => {
  const webhookUrl = process.env.NEWSLETTER_SHEETS_WEBHOOK_URL;
  const apiKey =
    process.env.NEWSLETTER_SHEETS_API_KEY ?? process.env.GOOGLE_SHEETS_API_KEY;

  if (!webhookUrl) {
    console.info("[newsletter] skipped — NEWSLETTER_SHEETS_WEBHOOK_URL not set");
    return { ok: true, skipped: true };
  }

  const endpoint = apiKey
    ? `${webhookUrl}${webhookUrl.includes("?") ? "&" : "?"}apiKey=${encodeURIComponent(apiKey)}`
    : webhookUrl;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "subscriber",
        email,
        source,
        ts: new Date().toISOString(),
      }),
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn("[newsletter] provider non-2xx", { status: res.status });
      return { ok: false, error: "provider_error" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[newsletter] provider exception", (err as Error).message);
    return { ok: false, error: "provider_error" };
  }
};

const activeProvider: NewsletterProvider = sheetsProvider;

export async function subscribe(
  emailRaw: string,
  source = "footer",
): Promise<SubscribeResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!isValidEmail(email)) {
    return { ok: false, error: "invalid_email" };
  }
  return activeProvider(email, source);
}
