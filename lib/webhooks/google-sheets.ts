/**
 * Google Sheets webhook dispatcher.
 *
 * Mirrors the column order of the Apps Script in `webhook-script.js` and the
 * CSV template in `Fanaa_Store Orders - Feuille 1.csv`. Sending a flat object
 * keeps Apps Script trivial (`sheet.appendRow([...])`).
 *
 * Two payload kinds:
 *   • `kind: "order"`  → append a new row when a COD order is confirmed.
 *   • `kind: "upsell"` → upsert the existing row in-place when the
 *                        post-purchase 99-SAR offer is accepted. The Apps
 *                        Script side stores `orderId → rowIndex` in its
 *                        PropertiesService so this works even after a deploy.
 *
 * Best-effort: a failed sheet append must NEVER block an order ack. The
 * order route wraps every dispatcher in `Promise.allSettled`.
 */

import type { Money } from "@/lib/types";

/* ─────────────────────────── Order payload ──────────────────────────────── */

export type SheetsOrderRow = {
  kind: "order";

  /**
   * Stable id for upsert during the post-purchase upsell flow. Sent to
   * Apps Script which keeps an `orderId → rowIndex` map in its
   * PropertiesService key/value store.
   */
  orderId: string;

  /** Pre-formatted as `DD/MM/YYYY` in KSA time (e.g. `11/05/2026`). */
  orderDate: string;

  /** Always "KSA" — we only ship inside Saudi Arabia. */
  country: "KSA";

  fullName: string;

  /**
   * Saudi phone normalised to digits only, no `+` prefix
   * (e.g. `966512345678`). Built from the E.164 form by stripping the `+`.
   */
  phone: string;

  /**
   * Free-text "City — Street/District/Landmark". Empty string when the
   * checkout popup didn't ask for it (minimum-friction funnels) — per the
   * brief: "If address is missing: send empty string".
   */
  fullAddress: string;

  /** Full URL of the product page the order was placed from. */
  productUrl: string;

  /** SKU(s). Multi-product orders join with "/" — see `lib/sku.ts`. */
  sku: string;

  /** Arabic product name(s). Multi-product orders join with "/". */
  productName: string;

  /**
   * Total quantity. Single product → "2". Multi-product → "2/1/3".
   * Stored as string because the multi-product form is not a number.
   */
  totalQuantity: string;

  /** Final order total in major units (e.g. `349`). Includes any upsell. */
  variantPrice: number;

  /** Always "SAR". */
  currency: "SAR";
};

/* ─────────────────────────── Upsell payload ─────────────────────────────── */

export type SheetsUpsellRow = {
  kind: "upsell";

  /** Original order id — Apps Script uses this to locate the existing row. */
  orderId: string;

  upsellSku: string;
  upsellProductName: string;

  /** Almost always 1; kept flexible. */
  upsellQuantity: number;

  /** Price of the upsell item in major units (e.g. `99`). */
  upsellPrice: number;

  /** Always "SAR". */
  currency: "SAR";
};

type SheetsPayload = SheetsOrderRow | SheetsUpsellRow;

/* ─────────────────────────── Dispatcher ─────────────────────────────────── */

type DispatchOptions = {
  url?: string;
  apiKey?: string;
  row: SheetsPayload;
};

export async function dispatchToGoogleSheets({
  url,
  apiKey,
  row,
}: DispatchOptions) {
  if (!url) {
    console.info("[sheets webhook] skipped — GOOGLE_SHEETS_WEBHOOK_URL not set");
    return { ok: true, skipped: true as const };
  }

  // Apps Script can't read custom HTTP headers, so the shared secret travels
  // as a `?apiKey=` query param. Apps Script reads it from `e.parameter`.
  const endpoint = apiKey
    ? `${url}${url.includes("?") ? "&" : "?"}apiKey=${encodeURIComponent(apiKey)}`
    : url;

  // `safeEndpoint` redacts the API key for log lines.
  const safeEndpoint = apiKey
    ? `${url}${url.includes("?") ? "&" : "?"}apiKey=***`
    : url;

  const orderId = (row as { orderId?: string }).orderId ?? "";
  const kind = (row as { kind?: string }).kind ?? "order";

  console.info("[sheets webhook] → request start", {
    kind,
    orderId,
    endpoint: safeEndpoint,
  });

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(row),
      cache: "no-store",
      // CRITICAL — `script.google.com/macros/s/<id>/exec` returns 302 to
      // `script.googleusercontent.com` where the script actually runs.
      // Node's fetch (undici) defaults to "follow"; setting it explicitly
      // guards against runtime changes that would silently break appends.
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    const body = await safeReadBody(res);
    if (res.ok) {
      console.info("[sheets webhook] ← response", {
        kind,
        orderId,
        status: res.status,
        body,
      });
    } else {
      console.warn("[sheets webhook] ← non-2xx", {
        kind,
        orderId,
        status: res.status,
        body,
      });
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    const message = (err as Error).message;
    console.error("[sheets webhook] ← exception", {
      kind,
      orderId,
      endpoint: safeEndpoint,
      error: message,
    });
    return { ok: false, error: message };
  }
}

async function safeReadBody(res: Response): Promise<string> {
  try {
    const txt = await res.text();
    return txt.length > 300 ? `${txt.slice(0, 300)}…` : txt;
  } catch {
    return "";
  }
}

/* ───────────────────────── Display helpers ──────────────────────────────── */

/** Format a Money object as "349.00 SAR" — readable inside Google Sheets. */
export function formatMoneyForSheets(money: Money): string {
  return `${(money.amount / 100).toFixed(2)} ${money.currency}`;
}

/**
 * `Asia/Riyadh` (UTC+3, no DST) DD/MM/YYYY formatter — matches the brief.
 * Built from `Intl.DateTimeFormat` so it stays correct across server TZs
 * and never drifts because of host clock locale.
 */
export function formatOrderDateKSA(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const dd = parts.find((p) => p.type === "day")?.value ?? "";
  const mm = parts.find((p) => p.type === "month")?.value ?? "";
  const yyyy = parts.find((p) => p.type === "year")?.value ?? "";
  return `${dd}/${mm}/${yyyy}`;
}

/** Strip the leading "+" from an E.164 number. `+966512345678` → `966512345678`. */
export function phoneForSheets(e164OrLocal: string): string {
  return (e164OrLocal ?? "").replace(/^\+/, "").replace(/\s+/g, "");
}

/**
 * Compose a single "City — Address" string for the Full Address column.
 * Returns `""` when both inputs are empty (per the brief — no address →
 * empty string in the sheet).
 */
export function composeFullAddress(city?: string, address?: string): string {
  const c = (city ?? "").trim();
  const a = (address ?? "").trim();
  if (!c && !a) return "";
  if (c && a) return `${c} — ${a}`;
  return c || a;
}
