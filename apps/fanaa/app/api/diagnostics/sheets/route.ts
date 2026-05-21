import { NextResponse } from "next/server";
import { apiUrl, getApiBaseUrl, isTwoTier } from "@/lib/api";
import { dispatchToGoogleSheets } from "@/lib/webhooks/google-sheets";

/**
 * GET /api/diagnostics/sheets
 *
 * One-click integration check for the Google Sheets orders pipeline.
 * Open this URL in a browser after a deploy — it answers three
 * questions in the order they matter:
 *
 *   1. Are GOOGLE_SHEETS_WEBHOOK_URL and GOOGLE_SHEETS_API_KEY set
 *      in the running container?  (env)
 *   2. Does the Apps Script /exec URL respond at all?              (transport)
 *   3. Does the Apps Script accept the apiKey we send?             (auth)
 *
 * Uses a `kind: "ping"` POST payload that `webhook-script.js`
 * specifically handles WITHOUT appending a row, so this endpoint can
 * be hit repeatedly (including from monitoring) without polluting the
 * sheet.
 *
 * The endpoint deliberately returns 200 even on failures so the
 * response body is always inspectable. Always trust `ok` — never the
 * HTTP status of this endpoint.
 *
 * Security: returns ONLY booleans + the redacted host of the /exec
 * URL + a body preview. The API key is never echoed back.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

  const env = {
    GOOGLE_SHEETS_WEBHOOK_URL: Boolean(url),
    GOOGLE_SHEETS_API_KEY: Boolean(apiKey),
    webhookUrlHost: safeHost(url),
  };

  // Routing mode — surfaces the most common failure mode in production:
  // NEXT_PUBLIC_API_BASE_URL not inlined at build time, so the browser
  // posts orders to /api/orders (the embedded fallback) instead of the
  // FastAPI backend where Sheets dispatch + Postgres + pixel CAPI live.
  // `resolvedOrderPostUrl` is what `fetch(apiUrl("/api/orders"))` will
  // actually request — if it starts with "/" the storefront is in
  // standalone mode; if it's an absolute URL, two-tier mode is active.
  const apiBaseUrl = getApiBaseUrl();
  const routing = {
    mode: isTwoTier() ? ("two-tier" as const) : ("standalone" as const),
    NEXT_PUBLIC_API_BASE_URL: apiBaseUrl || null,
    resolvedOrderPostUrl: apiUrl("/api/orders"),
  };

  // In two-tier mode this Next.js service should NEVER be the one
  // dispatching to Sheets — that's the FastAPI backend's job. Tell the
  // operator to hit the backend's diagnostics URL instead so they're
  // looking at the same env that real orders flow through.
  if (routing.mode === "two-tier") {
    return NextResponse.json({
      ok: true,
      stage: "wrong-service",
      env,
      routing,
      hint:
        "This deployment is two-tier (NEXT_PUBLIC_API_BASE_URL is set), " +
        "so order traffic and Google Sheets dispatch are handled by the " +
        "FastAPI service at " +
        routing.NEXT_PUBLIC_API_BASE_URL +
        ". Run the diagnostic there instead: GET " +
        routing.NEXT_PUBLIC_API_BASE_URL +
        "/diagnostics/sheets",
    });
  }

  if (!url) {
    return NextResponse.json({
      ok: false,
      stage: "env",
      env,
      routing,
      error: "GOOGLE_SHEETS_WEBHOOK_URL is not set in this environment.",
      hint:
        routing.mode === "standalone"
          ? "This build is in STANDALONE mode (NEXT_PUBLIC_API_BASE_URL " +
            "was empty at build time) so the Next.js fallback is the " +
            "one talking to Sheets. Either (a) set GOOGLE_SHEETS_* on " +
            "this storefront service AND redeploy, or (b) — preferred — " +
            "set NEXT_PUBLIC_API_BASE_URL as a BUILD argument so the " +
            "browser posts orders to the FastAPI backend where Sheets, " +
            "Postgres, and pixel CAPI all already live."
          : "Set GOOGLE_SHEETS_WEBHOOK_URL (and GOOGLE_SHEETS_API_KEY) " +
            "in the EasyPanel env-var UI of the storefront service, " +
            "then redeploy.",
    });
  }
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      stage: "env",
      env,
      routing,
      error: "GOOGLE_SHEETS_API_KEY is not set in this environment.",
      hint:
        "Add GOOGLE_SHEETS_API_KEY in EasyPanel — it must match the " +
        "API_KEY constant inside webhook-script.js.",
    });
  }

  // Live ping. `kind: "ping"` is handled by webhook-script.js without
  // appending a row, so this is safe to hit from monitoring.
  const started = Date.now();
  const result = await dispatchToGoogleSheets({
    url,
    apiKey,
    // The dispatcher's typed payload is for orders/upsells; the wire
    // body is just JSON so a typed cast is the cleanest way to send
    // an out-of-band probe.
    row: { kind: "ping", orderId: "diagnostics_ping" } as never,
  });
  const elapsedMs = Date.now() - started;

  if (!result.ok) {
    const appOk = (result as { appOk?: boolean | null }).appOk ?? null;
    const status = (result as { status?: number }).status;
    return NextResponse.json({
      ok: false,
      stage: appOk === false ? "auth-or-app" : "transport",
      env,
      routing,
      elapsedMs,
      transport: {
        status: status ?? null,
        body: (result as { body?: string }).body ?? null,
        error: (result as { error?: string }).error ?? null,
      },
      hint:
        appOk === false
          ? "Apps Script returned ok:false. Most common cause: the " +
            "GOOGLE_SHEETS_API_KEY env var here does not match API_KEY " +
            "in webhook-script.js. Fix one to equal the other, then " +
            "Deploy → Manage deployments → ✎ → New version in Apps Script."
          : "The /exec URL did not respond as expected. Open the URL " +
            "in a browser — Apps Script's GET handler should return " +
            '{"ok":true,"service":"elfanaa-orders-webhook"}. If you ' +
            "see a Google sign-in screen instead, the deployment's " +
            "'Who has access' must be set to 'Anyone'.",
    });
  }

  // Body of a successful ping is `{"ok":true,"kind":"ping",...}` — but
  // only if the deployed Apps Script has the ping handler. Older
  // deployments will treat the ping as an order, append a row, and
  // reply with `{"ok":true,"kind":"order"}`. The check below catches
  // that case and instructs the operator to redeploy the script.
  const body = (result as { body?: string }).body ?? "";
  const respondedToPing = body.includes('"kind":"ping"');

  return NextResponse.json({
    ok: true,
    stage: respondedToPing ? "ping-acknowledged" : "appended-instead-of-pinged",
    env,
    routing,
    elapsedMs,
    transport: {
      status: (result as { status?: number }).status ?? null,
      body,
    },
    hint: respondedToPing
      ? "Healthy: the next COD order will append a row to your sheet."
      : "The Apps Script accepted the request but doesn't yet know " +
        "about kind:'ping' — it appended a row instead. Redeploy the " +
        "script (Apps Script editor → Deploy → Manage deployments → " +
        "✎ → New version) to pick up the ping handler. Real orders " +
        "are flowing already.",
  });
}

function safeHost(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}
