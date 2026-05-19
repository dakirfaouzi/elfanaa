/**
 * Google Sheets webhook dispatcher.
 *
 * Mirrors the column order of the Apps Script in `webhook-script.js` and the
 * CSV template in `Fanaa_Store Orders - Feuille 1.csv`. Sending a flat object
 * keeps Apps Script trivial (`sheet.appendRow([...])`).
 *
 * Three payload kinds:
 *   • `kind: "order"`         → append a new row when a COD order is confirmed.
 *   • `kind: "order_update"`  → rewrite SKU/Name/Quantity/URL/Price of an
 *                               existing row in place when the order grows
 *                               (post-purchase upsell accepted, additional
 *                               offers accepted, …). Carries the FULL final
 *                               state of the order. Supports an UNBOUNDED
 *                               number of slash-joined product segments —
 *                               there is no 3-slot ceiling.
 *   • `kind: "upsell"`        → LEGACY shape. Apps Script's _handleUpsell
 *                               still understands it for backward compatibility
 *                               with the single-tier Next.js fallback that
 *                               can't reconstruct the full order. New code
 *                               should send `order_update` instead.
 *
 * Best-effort: a failed sheet write must NEVER block an order ack. The
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

/* ───────────────────── Order-update payload (full state) ────────────────── */

/**
 * Full-state rewrite of an existing order row. Used whenever a new
 * line is added to an already-persisted order (post-purchase upsell,
 * additional upsells, late cross-sells, …). Apps Script locates the
 * row by `orderId` and overwrites the SKU / Product name / Total
 * quantity / Product URL / Variant price columns with these values.
 *
 * The slash-joined fields carry an UNBOUNDED number of segments —
 * one per accepted product line, in deterministic order
 * (base → upsell → cross_sell, insertion order within each bucket).
 * There is no 3-slot ceiling: `"S1/S2/S3/S4/S5/S6"` is valid and
 * round-trips through the Apps Script exactly as written.
 */
export type SheetsOrderUpdateRow = {
  kind: "order_update";

  /** Original order id — Apps Script uses this to locate the existing row. */
  orderId: string;

  /** Full slash-joined SKU list, one segment per product. */
  sku: string;
  /** Full slash-joined Arabic product names, one segment per product. */
  productName: string;
  /** Full slash-joined quantities, one segment per product. */
  totalQuantity: string;
  /** Full slash-joined per-product canonical URLs, one segment per product. */
  productUrl: string;

  /** Final order total in major units (e.g. `298`). Includes every line. */
  variantPrice: number;

  /** Always "SAR". */
  currency: "SAR";
};

/* ─────────────────────── Upsell payload (legacy) ────────────────────────── */

/**
 * @deprecated New code should send `SheetsOrderUpdateRow` instead.
 *
 * Kept for backward compatibility with the single-tier Next.js fallback
 * (`app/api/orders/[orderId]/upsell/route.ts`) which is stateless and
 * cannot rebuild the full final order. Apps Script still handles this
 * shape via `_handleUpsell` for any in-flight requests from older
 * frontends or for orphan upsells whose base row was lost.
 */
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

type SheetsPayload = SheetsOrderRow | SheetsOrderUpdateRow | SheetsUpsellRow;

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

/* ─────────────────────── Dynamic order-row formatter ─────────────────────── */

/**
 * A single accepted product line as seen by the Sheets row builder.
 *
 * `url` is the canonical product page URL (relative `/sugarbear` or
 * `/products/<slug>`, or an absolute origin-prefixed form when the
 * caller has the site URL handy). Empty string is acceptable when no
 * URL is meaningful for the line.
 *
 * `source` drives ONLY the deterministic ordering inside the joined
 * cell — base items first, then upsells (in insertion order), then
 * cross-sells (in insertion order). It does NOT collapse anything:
 * every line gets its own segment, with no fixed-slot ceiling.
 */
export type OrderRowLine = {
  sku: string;
  /** Arabic title, exactly as it should appear in the sheet. */
  name: string;
  quantity: number;
  /** Canonical per-product URL — relative or absolute. */
  url: string;
  source: "base" | "upsell" | "cross_sell";
};

export type OrderRowFields = {
  /** `sku/sku/sku/…` — one segment per line. */
  sku: string;
  /** `name/name/name/…` — one segment per line. */
  productName: string;
  /** `q/q/q/…` — one segment per line. */
  totalQuantity: string;
  /** `url/url/url/…` — one segment per line. */
  productUrl: string;
};

/**
 * Build the dynamic, slash-joined `{sku, productName, totalQuantity,
 * productUrl}` quadruplet from a list of accepted order lines.
 *
 * Output is FULLY DYNAMIC — one segment per input line. There is NO
 * 3-slot ceiling, NO empty-slot padding, and NO collapsing of multiple
 * lines into a single slot. A 6-line order produces a 6-segment row.
 *
 * Ordering rule (deterministic, regardless of insertion order):
 *
 *   1. `source === "base"`       (insertion order preserved within bucket)
 *   2. `source === "upsell"`     (post-purchase offers, insertion order)
 *   3. `source === "cross_sell"` (in-cart cross-sell card adds, insertion order)
 *
 * Lines tagged with an unknown source collapse into the `base` bucket so
 * the row is never silently dropped.
 *
 * Examples (per the production brief — no fixed 3-slot assumption):
 *
 *   1 base                                  → `"1"`           (totalQuantity)
 *   2 base + 1 upsell + 3 cross-sell        → `"2/1/3"`
 *   1 base + 5 upsells                      → `"1/1/1/1/1/1"` (6 segments)
 *   3 base + mixed upsells and cross-sells  → `"3/1/1/2/1"`
 *
 * Compatible with downstream Apps Script `_handleOrderUpdate`, which
 * simply overwrites the row's joined cells with these strings.
 */
export function buildOrderRow(lines: OrderRowLine[]): OrderRowFields {
  const SOURCE_RANK: Record<OrderRowLine["source"], number> = {
    base: 0,
    upsell: 1,
    cross_sell: 2,
  };
  const ordered: OrderRowLine[] = lines
    .map((line, idx) => ({
      line: {
        ...line,
        source:
          line.source === "base" ||
          line.source === "upsell" ||
          line.source === "cross_sell"
            ? line.source
            : ("base" as const),
      },
      idx,
    }))
    .sort((a, b) => {
      const r = SOURCE_RANK[a.line.source] - SOURCE_RANK[b.line.source];
      // Stable: preserve original insertion order within the same bucket.
      return r !== 0 ? r : a.idx - b.idx;
    })
    .map(({ line }) => line);

  return {
    sku: ordered.map((l) => l.sku ?? "").join("/"),
    productName: ordered.map((l) => l.name ?? "").join("/"),
    totalQuantity: ordered.map((l) => String(l.quantity ?? 0)).join("/"),
    productUrl: ordered.map((l) => l.url ?? "").join("/"),
  };
}

/* ─────────────────── Legacy three-slot formatter (deprecated) ─────────────── */

/**
 * @deprecated Use `OrderRowLine` + `buildOrderRow` instead. The
 * 3-slot model truncates orders with 2+ upsells (the live "2/1/3"
 * vs expected "2/1/1/3" regression). Kept only so any in-flight
 * caller of the old API keeps compiling; no production code paths
 * still depend on it.
 */
export type ThreeSlotLine = {
  sku: string;
  name: string;
  quantity: number;
  source: "base" | "upsell" | "cross_sell";
};

/** @deprecated See {@link ThreeSlotLine}. */
export type ThreeSlotRow = {
  sku: string;
  productName: string;
  totalQuantity: string;
};

/**
 * @deprecated Use {@link buildOrderRow} instead.
 *
 * Reimplemented as a thin shim on top of `buildOrderRow` so legacy
 * callers stay correct, but with one critical difference: each input
 * line keeps its own segment instead of being summed inside a bucket.
 * That matches the new dynamic contract — every line round-trips —
 * even when invoked through the deprecated API.
 */
export function buildThreeSlotRow(lines: ThreeSlotLine[]): ThreeSlotRow {
  const dyn = buildOrderRow(
    lines.map((l) => ({
      sku: l.sku,
      name: l.name,
      quantity: l.quantity,
      url: "",
      source: l.source,
    })),
  );
  return {
    sku: dyn.sku,
    productName: dyn.productName,
    totalQuantity: dyn.totalQuantity,
  };
}
