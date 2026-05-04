/**
 * Google Sheets webhook dispatcher.
 *
 * The receiving end is a Google Apps Script Web App with a `doPost(e)` handler
 * that reads `e.postData.contents` as JSON and appends a row to a sheet.
 * See README → "Google Sheets webhook" for the script template.
 *
 * Why a row-shaped payload?
 *   Apps Script's `sheet.appendRow()` consumes a flat array. Sending a
 *   pre-flattened object lets the script declare its column order in one
 *   place (`COLUMNS.map(c => row[c])`) which is far easier than walking a
 *   nested order graph inside Apps Script.
 *
 * The dispatcher itself is best-effort: a failed Sheets append must NEVER
 * block an order from being acknowledged. The route handler treats the
 * sheets call as a side-effect and `Promise.allSettled` swallows any error.
 */

import type { Locale, Money } from "@/lib/types";

export type SheetsOrderRow = {
  /** ISO timestamp at the moment the row is created (UTC). */
  receivedAt: string;
  orderId: string;
  /** Customer-facing name (BiDi-safe — Apps Script will render in original direction). */
  fullName: string;
  /** Local Saudi format `05XXXXXXXX`. */
  phone: string;
  /** International `+9665…` form for click-to-call from Sheets. */
  phoneE164: string;
  /** Comma-joined "Title × qty" list, sorted for human readability. */
  items: string;
  itemCount: number;
  /** Subtotal in major units (e.g. 349.00) for natural display in the sheet. */
  subtotal: number;
  currency: string;
  paymentMethod: "cod";
  locale: Locale;
  /** Source surface — useful when you start running ad funnels. */
  source: string;
};

type DispatchOptions = {
  url?: string;
  apiKey?: string;
  row: SheetsOrderRow;
};

export async function dispatchToGoogleSheets({ url, apiKey, row }: DispatchOptions) {
  if (!url) return { ok: true, skipped: true as const };

  // Apps Script web apps don't support custom HTTP headers from arbitrary
  // origins — the API key travels as a query string instead and is checked
  // server-side via `e.parameter.apiKey`.
  const endpoint = apiKey
    ? `${url}${url.includes("?") ? "&" : "?"}apiKey=${encodeURIComponent(apiKey)}`
    : url;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(row),
      cache: "no-store",
      // Google's edge can be sluggish — fail fast so we don't hold the route.
      signal: AbortSignal.timeout(8_000),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Format a Money object as "349.00 SAR" — readable inside Google Sheets. */
export function formatMoneyForSheets(money: Money): string {
  return `${(money.amount / 100).toFixed(2)} ${money.currency}`;
}
