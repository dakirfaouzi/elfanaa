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

    // Apps Script ALWAYS replies HTTP 200, even for auth/JSON errors. The
    // real success signal lives inside the JSON body: `{"ok": true, ...}`
    // for a row append, `{"ok": false, "error": "unauthorized"}` for a
    // bad apiKey, etc. Treat a 200 with `ok: false` as a failure so the
    // EasyPanel app logs surface the real reason orders aren't landing
    // in the sheet — otherwise misconfigured API keys are invisible.
    const parsed = tryParseJson(body);
    const appOk = parsed && typeof parsed === "object" && (parsed as { ok?: unknown }).ok === true;
    const transportOk = res.ok;
    const ok = transportOk && (parsed === undefined ? true : Boolean(appOk));

    if (ok) {
      console.info("[sheets webhook] ← response", {
        kind,
        orderId,
        status: res.status,
        finalUrlHost: safeUrlHost(res.url),
        body,
      });
    } else if (!transportOk) {
      console.warn("[sheets webhook] ← non-2xx", {
        kind,
        orderId,
        status: res.status,
        finalUrlHost: safeUrlHost(res.url),
        body,
      });
    } else {
      // 200 OK transport but Apps Script reported a logical error
      // (unauthorized / invalid_json / setup error). This is the most
      // common production failure mode — surface it loudly.
      const appError =
        (parsed && typeof parsed === "object" && (parsed as { error?: unknown }).error) || "unknown";
      console.error("[sheets webhook] ← app-level failure (HTTP 200, ok=false)", {
        kind,
        orderId,
        status: res.status,
        finalUrlHost: safeUrlHost(res.url),
        appError,
        body,
        hint:
          appError === "unauthorized"
            ? "GOOGLE_SHEETS_API_KEY does not match API_KEY in webhook-script.js. Update one to match the other and redeploy the Apps Script (Deploy → Manage deployments → ✎ → New version)."
            : "Open the Apps Script editor → Executions tab → inspect the failing run.",
      });
    }

    return { ok, status: res.status, body, appOk: parsed ? Boolean(appOk) : null };
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

function tryParseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function safeUrlHost(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).host;
  } catch {
    return undefined;
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

/* ─────────────────────── Three-slot formatter ─────────────────────────── */

/**
 * A single line as seen by the 3-slot formatter — just the fields the
 * slot grouping cares about. Both the Next.js fallback and the FastAPI
 * webhook pipeline build this shape from their respective ORM/route
 * data and call `buildThreeSlotRow` to get a deterministic `base /
 * upsell / cross_sell` projection.
 */
export type ThreeSlotLine = {
  sku: string;
  /** Arabic title, exactly as it should appear in the sheet. */
  name: string;
  quantity: number;
  source: "base" | "upsell" | "cross_sell";
};

export type ThreeSlotRow = {
  /** `sku/sku/sku` — empty slots collapse to "" within the join. */
  sku: string;
  /** `name/name/name`. */
  productName: string;
  /** `q/q/q` — missing slots become `0` so the structure is preserved. */
  totalQuantity: string;
};

/** Inner separator inside a single slot when 2+ items share that slot. */
const SLOT_INNER_SEP = " + ";

/**
 * Build the deterministic 3-slot `{sku, productName, totalQuantity}`
 * triplet from a list of order lines.
 *
 * Slot order is ALWAYS:
 *   index 0 → base items   (`source === "base"`, default)
 *   index 1 → upsell items (`source === "upsell"`)
 *   index 2 → cross-sell   (`source === "cross_sell"`)
 *
 * If a slot has no items, its SKU/name slot is `""` and its quantity
 * slot is `"0"` so the structure stays parseable downstream. If a slot
 * has multiple items (e.g. a multi-product base cart), their SKUs /
 * names are joined with " + " inside the slot and quantities are
 * summed (the slash separator is reserved for between-slot joins).
 *
 * This matches the production brief exactly:
 *   - `1/1/3`  → 1 base + 1 upsell + 3 cross-sell
 *   - `3/0/0`  → 3 base, no upsell, no cross-sell
 *   - `1//`    will NEVER happen — empty SKU slots are still present
 *               so the row is round-trippable.
 *
 * For the typical `/sugarbear` funnel (single base product), the base
 * slot resolves to the single item's qty/name/sku exactly as before
 * — the format only widens to 3 slots, never narrows to 1.
 */
export function buildThreeSlotRow(lines: ThreeSlotLine[]): ThreeSlotRow {
  const buckets: Record<"base" | "upsell" | "cross_sell", ThreeSlotLine[]> = {
    base: [],
    upsell: [],
    cross_sell: [],
  };
  for (const line of lines) {
    buckets[line.source].push(line);
  }

  const slot = (key: "base" | "upsell" | "cross_sell") => {
    const items = buckets[key];
    if (items.length === 0) {
      return { sku: "", name: "", quantity: 0 };
    }
    const totalQty = items.reduce((acc, it) => acc + (it.quantity || 0), 0);
    return {
      sku: items.map((it) => it.sku).filter(Boolean).join(SLOT_INNER_SEP),
      name: items.map((it) => it.name).filter(Boolean).join(SLOT_INNER_SEP),
      quantity: totalQty,
    };
  };

  const base = slot("base");
  const upsell = slot("upsell");
  const cross = slot("cross_sell");

  return {
    sku: [base.sku, upsell.sku, cross.sku].join("/"),
    productName: [base.name, upsell.name, cross.name].join("/"),
    totalQuantity: [base.quantity, upsell.quantity, cross.quantity].join("/"),
  };
}
