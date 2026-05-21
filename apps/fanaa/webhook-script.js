/**
 * ELFANAA — Google Apps Script web app.
 *
 * Single-tab orders ledger. Every COD order placed on ANY product page on
 * the website appends one row here. When the order grows after the initial
 * append (post-purchase upsell accepted, additional upsell offers, late
 * cross-sells, …) the same row is REWRITTEN IN PLACE with the FINAL real
 * order — every product on a separate slash-joined segment, no fixed-slot
 * ceiling.
 *
 * Three message kinds (`kind` field on the JSON body):
 *
 *   • "order"         → append a fresh row (idempotent on `orderId`).
 *   • "order_update"  → locate the existing row by `orderId` and OVERWRITE
 *                       its SKU / Product name / Total quantity / Product URL
 *                       / Variant price columns with the FULL final state.
 *                       Supports an UNBOUNDED number of slash-joined
 *                       segments per cell — e.g. `"FN-1/FN-2/FN-3/FN-4/FN-5"`
 *                       round-trips exactly as written. THIS is the path
 *                       every multi-upsell / multi-cross-sell stack uses.
 *   • "upsell"        → LEGACY. Pre-rewrite shape: a single upsell line is
 *                       merged into a fixed 3-slot row. Kept ONLY so any
 *                       in-flight requests from older bundles still work;
 *                       new server code paths emit `order_update` instead.
 *

 * ─────────────────────────────────────────────────────────────────────────
 * DEPLOYMENT (5 minutes — do this once per environment)
 * ─────────────────────────────────────────────────────────────────────────
 *   1. Open the Google Sheet that holds your orders (e.g. "ELFANAA · Orders").
 *      The CSV template in `Fanaa_Store Orders - Feuille 1.csv` shows the
 *      exact column order. Paste those 11 headers into row 1 — or just
 *      run `setupHeaders()` once from the Apps Script editor and they get
 *      written for you.
 *
 *   2. Extensions → Apps Script. Paste THIS WHOLE FILE into the editor
 *      (Code.gs). Save.
 *
 *   3. Replace the value of `API_KEY` below with a long random string.
 *      Generate one with `openssl rand -hex 32` (or any password manager).
 *
 *   4. Deploy → New deployment → "Web app":
 *        • Description:    ELFANAA orders webhook v1
 *        • Execute as:     Me
 *        • Who has access: Anyone
 *      Copy the resulting URL — it ends with `/exec`.
 *
 *   5. Paste both values into your environment:
 *
 *        # .env (frontend — single-tier deploy)            OR
 *        # backend/.env (FastAPI service — recommended)
 *
 *        GOOGLE_SHEETS_WEBHOOK_URL=<that /exec URL>
 *        GOOGLE_SHEETS_API_KEY=<same string as API_KEY below>
 *
 *      In EasyPanel, set them in the env-var UI of the elfanaa_app
 *      (or elfanaa_api) service. No code change needed to switch keys.
 *
 *   6. Test it with curl (or just place a fake order from the storefront):
 *
 *        curl -X POST "$URL?apiKey=$KEY" \
 *             -H "content-type: application/json" \
 *             -d '{"kind":"order","orderId":"test_1","orderDate":"11/05/2026",
 *                  "country":"KSA","fullName":"اختبار","phone":"966512345678",
 *                  "fullAddress":"","productUrl":"https://elfanaa.com/sugarbear",
 *                  "sku":"FN-SUG-004","productName":"فيتامينات سوجاربير للشعر",
 *                  "totalQuantity":"3","variantPrice":349,"currency":"SAR"}'
 *
 *      You should see one new row in the sheet and `{"ok":true,"kind":"order"}`
 *      in the response.
 *
 *   7. Re-deploys: every time you edit this file → Deploy → Manage
 *      deployments → ✎ → New version → Deploy. The /exec URL stays the
 *      same so you never need to update the storefront env vars.
 *
 *   8. Verify end-to-end from a browser (no test order needed):
 *
 *        https://<your-site>/api/diagnostics/sheets
 *
 *      The endpoint reports whether GOOGLE_SHEETS_WEBHOOK_URL and
 *      GOOGLE_SHEETS_API_KEY are set in EasyPanel, then sends a
 *      `kind:"ping"` POST to your /exec URL. A green response means
 *      every order will reach this sheet. Auth or URL problems are
 *      reported with a concrete remediation hint.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY APPS SCRIPT (vs. Sheets API)
 * ─────────────────────────────────────────────────────────────────────────
 *   • Zero auth ceremony — no service-account JSON, no scope wrangling.
 *   • Free for ~20k req/day. Plenty for a launch funnel.
 *   • Locks the sheet to your Google account by definition.
 *   • One file, never breaks, no runtime to maintain.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SECURITY
 * ─────────────────────────────────────────────────────────────────────────
 *   The API key travels as `?apiKey=…` in the query string. Apps Script
 *   web apps can't read custom HTTP headers from arbitrary origins, so
 *   HMAC is awkward — the query-string gate is the standard pattern.
 *   The sheet itself is private to your Google account; the /exec URL is
 *   unguessable. Rotate the key by editing both this file AND the env
 *   vars in EasyPanel.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CORS
 * ─────────────────────────────────────────────────────────────────────────
 *   All ELFANAA webhook calls originate server-side (Next.js / FastAPI),
 *   so the browser's CORS policy never enters the picture. `doOptions` is
 *   still provided so the endpoint behaves correctly if a future page
 *   ever calls it directly from the client.
 */

/* eslint-disable no-undef */

const API_KEY = "REPLACE_WITH_A_LONG_RANDOM_STRING"; // ← rotate me + env var

const SHEET_NAME = "Orders";

/**
 * Column order — MUST match `Fanaa_Store Orders - Feuille 1.csv` AND the
 * `SheetsOrderRow` type in `lib/webhooks/google-sheets.ts`. Editing this
 * list is a breaking change: re-run `setupHeaders()` if you do.
 */
const HEADERS = [
  "Order date",
  "Country",
  "Full name",
  "Phone",
  "Full Address",
  "Product URL",
  "SKU",
  "Product name",
  "Total quantity",
  "Variant price",
  "Order customer currency",
];

const COL = {
  ORDER_DATE: 1,
  COUNTRY: 2,
  FULL_NAME: 3,
  PHONE: 4,
  FULL_ADDRESS: 5,
  PRODUCT_URL: 6,
  SKU: 7,
  PRODUCT_NAME: 8,
  TOTAL_QUANTITY: 9,
  VARIANT_PRICE: 10,
  CURRENCY: 11,
};

const MULTI_SEP = "/";

/* ─────────────────────────────────────────────────────────────────────────
 *  HTTP HANDLERS
 * ────────────────────────────────────────────────────────────────────── */

function doPost(e) {
  try {
    if (!_authorized(e)) {
      return _json({ ok: false, error: "unauthorized" });
    }

    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (_) {
      return _json({ ok: false, error: "invalid_json" });
    }

    // Diagnostics ping — proves URL + apiKey + deployment are healthy
    // without appending a row. The Next.js / FastAPI diagnostics
    // endpoints (`/api/diagnostics/sheets`) POST `{kind:"ping"}` so an
    // operator can verify the integration from a browser in one click.
    if (body && body.kind === "ping") {
      return _json({
        ok: true,
        kind: "ping",
        sheetName: SHEET_NAME,
        timestamp: new Date().toISOString(),
      });
    }

    var sheet = _ensureSheet();
    var kind = body && body.kind;

    if (kind === "order_update") {
      return _handleOrderUpdate(sheet, body);
    }
    if (kind === "upsell") {
      return _handleUpsell(sheet, body);
    }
    // Default = "order" (treat any other / missing kind as a new order
    // append rather than 500ing — preserves the old behaviour where
    // payloads without `kind` were assumed to be order rows).
    return _handleOrder(sheet, body);
  } catch (err) {
    return _json({
      ok: false,
      error: String(err && err.message ? err.message : err),
    });
  }
}

/** Health check — visit the /exec URL in a browser to confirm it's live. */
function doGet() {
  return _json({ ok: true, service: "elfanaa-orders-webhook" });
}

/** Pre-flight responder for any future browser-side caller. */
function doOptions() {
  return _json({ ok: true });
}

/* ─────────────────────────────────────────────────────────────────────────
 *  ORDER  — append a new row
 * ────────────────────────────────────────────────────────────────────── */

function _handleOrder(sheet, body) {
  var orderId = _str(body.orderId);

  // Idempotency: if the same orderId was already appended, do not duplicate.
  if (orderId && _findRowByOrderId(orderId)) {
    return _json({ ok: true, kind: "order", duplicate: true });
  }

  var row = [
    _str(body.orderDate),
    _str(body.country) || "KSA",
    _str(body.fullName),
    _str(body.phone),
    _str(body.fullAddress),
    _str(body.productUrl),
    _str(body.sku),
    _str(body.productName),
    _str(body.totalQuantity),
    _num(body.variantPrice),
    _str(body.currency) || "SAR",
  ];

  sheet.appendRow(row);
  var lastRow = sheet.getLastRow();

  // Belt-and-suspenders: even if `setupHeaders()` was never re-run
  // after the auto-format upgrade, force every text-bearing column on
  // this new row to plain text. This guarantees the next upsell merge
  // sees the literal "1" / "2/1/3" / "FN-1/FN-2/FN-3" string instead
  // of a Sheets-parsed Date or Number — preventing the `Total quantity`
  // ever drifting into "Sat Jan 03 2026 00:00:00" territory.
  //
  // The Product URL column is included now too because the dynamic
  // builder joins per-product URLs with "/" — without text format,
  // Sheets would mangle a multi-URL cell into the first URL only.
  _writeAsText(sheet, lastRow, COL.PRODUCT_URL, body.productUrl);
  _writeAsText(sheet, lastRow, COL.SKU, body.sku);
  _writeAsText(sheet, lastRow, COL.PRODUCT_NAME, body.productName);
  _writeAsText(sheet, lastRow, COL.TOTAL_QUANTITY, body.totalQuantity);

  if (orderId) {
    _rememberOrderRow(orderId, lastRow);
  }
  return _json({ ok: true, kind: "order" });
}

/* ─────────────────────────────────────────────────────────────────────────
 *  ORDER_UPDATE  —  full-row rewrite (the multi-upsell path)
 *
 *  Locates the row for `orderId` and OVERWRITES the slash-joined cells
 *  with the full final state. No slot arithmetic, no fixed-shape
 *  assumption — the payload carries the complete list of segments for
 *  every cell. Supports unbounded segment counts (the new architecture
 *  is the only way to faithfully persist 2+ upsells or 4+ cross-sells).
 *
 *  Idempotency: this handler is safe to re-deliver. Each call rewrites
 *  the same cells with the same final state.
 *
 *  Orphan handling: if the orderId is unknown (the original `order`
 *  webhook never reached the sheet) we append a fresh row carrying the
 *  full state — so revenue is never lost just because the first
 *  message dropped.
 * ────────────────────────────────────────────────────────────────────── */

function _handleOrderUpdate(sheet, body) {
  var orderId = _str(body.orderId);
  if (!orderId) {
    return _json({ ok: false, error: "missing_order_id" });
  }

  var rowIdx = _findRowByOrderId(orderId);
  if (!rowIdx) {
    // Orphan — the base `order` webhook never created a row for this
    // id. Append a fresh row containing the full final state so the
    // sale still lands in the sheet. Customer/address fields are
    // unknown here (this payload only carries product fields), so the
    // operator sees a partial row tagged with the orderId — better
    // than zero rows.
    sheet.appendRow([
      "", // Order date
      "KSA",
      "",
      "",
      "",
      _str(body.productUrl),
      _str(body.sku),
      _str(body.productName),
      _str(body.totalQuantity),
      _num(body.variantPrice),
      _str(body.currency) || "SAR",
    ]);
    var orphanRow = sheet.getLastRow();
    _writeAsText(sheet, orphanRow, COL.PRODUCT_URL, body.productUrl);
    _writeAsText(sheet, orphanRow, COL.SKU, body.sku);
    _writeAsText(sheet, orphanRow, COL.PRODUCT_NAME, body.productName);
    _writeAsText(sheet, orphanRow, COL.TOTAL_QUANTITY, body.totalQuantity);
    _rememberOrderRow(orderId, orphanRow);
    return _json({ ok: true, kind: "order_update", orphan: true });
  }

  // Atomic rewrite — every multi-segment cell is overwritten with the
  // server's final state. Force text format BEFORE setValue so Sheets
  // does not try to date-parse "1/1/3" or "FN-1/FN-2/FN-3" cells.
  _writeAsText(sheet, rowIdx, COL.PRODUCT_URL, body.productUrl);
  _writeAsText(sheet, rowIdx, COL.SKU, body.sku);
  _writeAsText(sheet, rowIdx, COL.PRODUCT_NAME, body.productName);
  _writeAsText(sheet, rowIdx, COL.TOTAL_QUANTITY, body.totalQuantity);
  sheet
    .getRange(rowIdx, COL.VARIANT_PRICE)
    .setValue(Number(body.variantPrice) || 0);

  return _json({ ok: true, kind: "order_update", row: rowIdx });
}

/* ─────────────────────────────────────────────────────────────────────────
 *  UPSELL  —  upsert the original row in place
 *
 *  Slot model: base orders are appended with a deterministic 3-slot
 *  format `base / upsell / cross_sell` for SKU / Product name / Total
 *  quantity. At base-order time the upsell slot is empty (SKU/name) or
 *  "0" (quantity). When the buyer accepts the post-purchase 99-SAR
 *  offer, this handler REPLACES the middle (upsell) slot in place —
 *  so a row that started as "3/0/0" becomes "3/1/0" without ever
 *  growing into "3/1" / "3/0/0/1" / other ambiguous shapes.
 *
 *  Apps Script keeps `order:<orderId>` → row index in PropertiesService.
 *  Idempotent — if the same upsell SKU is already in slot 1, no-op.
 *
 *  Backwards compatibility: rows written by older versions of the
 *  storefront contained a single segment (`"3"`) or two segments
 *  (`"3/1"` — base + first cross-sell). `_ensureThreeSlots` pads
 *  legacy values to exactly three slots before the middle replacement
 *  so a single rollout step is enough — no manual sheet edits, no
 *  separate migration.
 * ────────────────────────────────────────────────────────────────────── */

function _handleUpsell(sheet, body) {
  var orderId = _str(body.orderId);
  if (!orderId) {
    return _json({ ok: false, error: "missing_order_id" });
  }

  var rowIdx = _findRowByOrderId(orderId);
  if (!rowIdx) {
    // The base order never made it (sheets dispatch failed) — log the
    // upsell as a standalone row so ops still sees the revenue.
    // Orphan rows also follow the 3-slot model: empty base slot,
    // populated upsell slot, empty cross-sell slot.
    var orphanQty = Number(body.upsellQuantity);
    if (!orphanQty || isNaN(orphanQty)) orphanQty = 1;
    var orphanSku = _replaceSlot("", 1, _str(body.upsellSku), "");
    var orphanName = _replaceSlot(
      "",
      1,
      _str(body.upsellProductName),
      "",
    );
    var orphanQtyStr = _replaceSlot("", 1, String(orphanQty), "0");
    sheet.appendRow([
      "",
      "KSA",
      "",
      "",
      "",
      "",
      orphanSku,
      orphanName,
      orphanQtyStr,
      _num(body.upsellPrice),
      _str(body.currency) || "SAR",
    ]);
    var orphanRow = sheet.getLastRow();
    _writeAsText(sheet, orphanRow, COL.SKU, orphanSku);
    _writeAsText(sheet, orphanRow, COL.PRODUCT_NAME, orphanName);
    _writeAsText(sheet, orphanRow, COL.TOTAL_QUANTITY, orphanQtyStr);
    return _json({ ok: true, kind: "upsell", orphan: true });
  }

  var range = sheet.getRange(rowIdx, 1, 1, HEADERS.length);
  var existing = range.getValues()[0];

  var existingSku = _str(existing[COL.SKU - 1]);
  var upsellSku = _str(body.upsellSku);

  // Idempotency: if the upsell SKU is already in slot 1 OR present
  // anywhere in the slash-joined SKU cell (legacy append behaviour
  // may have placed it elsewhere), treat as a duplicate hit and
  // no-op. Without this, Apps Script retries (network flakes,
  // dispatcher re-fires) would double-charge the row.
  if (upsellSku && existingSku.split(MULTI_SEP).indexOf(upsellSku) !== -1) {
    return _json({ ok: true, kind: "upsell", duplicate: true });
  }

  // Slot 1 (middle) = upsell. Pad to 3 slots first so legacy rows
  // get upgraded transparently. Empty defaults are "" for SKU/name
  // and "0" for quantity (matches `buildThreeSlotRow` on both
  // backends).
  var newSku = _replaceSlot(existingSku, 1, upsellSku, "");
  var newName = _replaceSlot(
    _str(existing[COL.PRODUCT_NAME - 1]),
    1,
    _str(body.upsellProductName),
    "",
  );

  // Robust read: if the cell is already a Date (legacy row written
  // before the text-format fix), recover a sensible "M/D" string
  // instead of joining "Sat Jan 03 2026 00:00:00.../1".
  var existingQty = _readTotalQuantityCell(existing[COL.TOTAL_QUANTITY - 1]);
  // Upsell quantity is sent by both dispatchers as a number/int; coerce
  // explicitly so a missing/zero value falls back to "1" rather than
  // producing "/0" or "/NaN".
  var upsellQty = Number(body.upsellQuantity);
  if (!upsellQty || isNaN(upsellQty)) upsellQty = 1;
  var newQty = _replaceSlot(existingQty, 1, String(upsellQty), "0");

  var existingPrice = Number(existing[COL.VARIANT_PRICE - 1]) || 0;
  var newPrice = existingPrice + (Number(body.upsellPrice) || 0);

  // CRITICAL — force text format BEFORE setValue on the three
  // slash-joined columns. Otherwise Sheets parses values like "3/1"
  // or "1/1" as dates and the cell becomes a Date object. The Variant
  // price stays numeric (Number is the correct type for the column).
  _writeAsText(sheet, rowIdx, COL.SKU, newSku);
  _writeAsText(sheet, rowIdx, COL.PRODUCT_NAME, newName);
  _writeAsText(sheet, rowIdx, COL.TOTAL_QUANTITY, newQty);
  sheet.getRange(rowIdx, COL.VARIANT_PRICE).setValue(newPrice);

  return _json({ ok: true, kind: "upsell", row: rowIdx });
}

/* ─────────────────────────────────────────────────────────────────────────
 *  SETUP — one-shot from the Apps Script editor on first deploy.
 * ────────────────────────────────────────────────────────────────────── */

function setupHeaders() {
  var sheet = _ensureSheet();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
  sheet
    .getRange(1, 1, 1, HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#f3f0e8");
  // Lock SKU / Product name / Total quantity to plain text so Sheets
  // can never auto-parse "1/1" / "3/1" / "2/1/3" as a Date. Safe to
  // re-run from the editor after upgrading the script.
  _applyTextFormatToColumns(sheet);
}

/* ─────────────────────────────────────────────────────────────────────────
 *  HELPERS
 * ────────────────────────────────────────────────────────────────────── */

function _ensureSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    _applyTextFormatToColumns(sheet);
  }
  return sheet;
}

function _authorized(e) {
  var apiKey = (e && e.parameter && e.parameter.apiKey) || "";
  return apiKey === API_KEY;
}

function _rememberOrderRow(orderId, rowIdx) {
  try {
    PropertiesService.getScriptProperties().setProperty(
      "order:" + orderId,
      String(rowIdx),
    );
  } catch (_) {
    /* PropertiesService quota is generous; ignore failures. */
  }
}

function _findRowByOrderId(orderId) {
  try {
    var v = PropertiesService.getScriptProperties().getProperty(
      "order:" + orderId,
    );
    return v ? parseInt(v, 10) || null : null;
  } catch (_) {
    return null;
  }
}

function _joinAppend(existing, addition) {
  if (!addition) return existing;
  if (!existing) return addition;
  return existing + MULTI_SEP + addition;
}

/**
 * Three-slot helper — pad an existing slash-joined cell to exactly
 * three slots and replace the slot at `slotIndex` (0-indexed) with
 * `value`, then re-join with `/`.
 *
 * Slot positions are fixed:
 *   0 → base       (original cart line(s) — not touched by upsell)
 *   1 → upsell     (post-purchase 99-SAR offer)
 *   2 → cross_sell (in-cart cross-sell card additions)
 *
 * `emptyFill` ("" for SKU/name, "0" for quantity) backfills missing
 * slots on legacy rows that were written with only 1 or 2 segments.
 * No change is made to the BASE or CROSS-SELL slots — they remain
 * exactly as the base order wrote them. This guarantees the row's
 * 3-slot shape after the upsell merge regardless of what was there
 * before.
 *
 *  Examples (slotIndex=1, emptyFill="0", value="1"):
 *    ""           → "0/1/0"
 *    "3"          → "3/1/0"
 *    "3/0"        → "3/1/0"
 *    "3/0/0"      → "3/1/0"
 *    "1/0/3"      → "1/1/3"
 */
function _replaceSlot(existing, slotIndex, value, emptyFill) {
  var fill = emptyFill == null ? "" : emptyFill;
  var parts = String(existing == null ? "" : existing).split(MULTI_SEP);
  while (parts.length < 3) parts.push(fill);
  if (parts.length > 3) parts = parts.slice(0, 3);
  // Normalize blank slots that come back as "" — backfill so the
  // cell always contains exactly three meaningful segments. Only
  // pad blanks, never overwrite real content.
  for (var i = 0; i < 3; i++) {
    if (parts[i] === "" || parts[i] == null) parts[i] = fill;
  }
  var replacement = value == null || value === "" ? fill : String(value);
  parts[slotIndex] = replacement;
  return parts.join(MULTI_SEP);
}

/**
 * Force a single cell to plain-text and write a literal string that
 * Sheets cannot auto-parse into a Date or Number.
 *
 * Why the leading apostrophe matters: `setNumberFormat("@")` only
 * controls how the cell DISPLAYS its value — Sheets still runs its
 * locale-aware input parser inside `setValue()` BEFORE the format
 * is applied. A bare `setValue("3/1")` therefore becomes a `Date`
 * cell (`Jan 03` in en-GB, `Mar 01` in en-US), regardless of the
 * column's number format.
 *
 * The leading `'` is Google Sheets' canonical "treat as literal text"
 * marker — identical to a user typing `'3/1` in the cell. Sheets
 * strips the apostrophe on display but skips type coercion entirely
 * at insert time. Combined with the `@` format we get both:
 *   • storage = literal string ("3/1", "2/1/3", "1/1")
 *   • display = the same literal string, no auto-format drift
 *
 * Empty / null / undefined input is written as a true empty cell
 * (no apostrophe) so blank cells stay blank rather than becoming a
 * stray `'`.
 */
function _writeAsText(sheet, rowIdx, colIdx, value) {
  var safe = _str(value);
  sheet
    .getRange(rowIdx, colIdx)
    .setNumberFormat("@")
    .setValue(safe === "" ? "" : "'" + safe);
}

/**
 * Apply plain-text format ("@") to every column that may hold a
 * slash-joined multi-value: Product URL, SKU, Product name, Total
 * quantity. (Variant price stays numeric — it is the only column
 * that benefits from arithmetic.)
 *
 * Run once at sheet creation and any time the headers are reset.
 * Safe to call repeatedly — `setNumberFormat` is idempotent.
 */
function _applyTextFormatToColumns(sheet) {
  // Skip the header row. Cover every existing data row plus any
  // additional rows Sheets has reserved (default 1000 on a fresh
  // sheet, more after manual rows are added).
  var dataRows = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, COL.PRODUCT_URL, dataRows, 1).setNumberFormat("@");
  sheet.getRange(2, COL.SKU, dataRows, 1).setNumberFormat("@");
  sheet.getRange(2, COL.PRODUCT_NAME, dataRows, 1).setNumberFormat("@");
  sheet.getRange(2, COL.TOTAL_QUANTITY, dataRows, 1).setNumberFormat("@");
}

/**
 * Best-effort recovery for legacy rows where a previous broken upsell
 * already let Sheets coerce the quantity cell into a Date. We cannot
 * recover the original "X/Y" exactly because the locale that did the
 * parse is the host spreadsheet's — but rebuilding `month/day` from
 * the Date components gives a sensible string the next upsell can
 * keep joining onto without producing "Sat Jan 03 2026.../1".
 *
 * For fresh rows written by this version of the script the cell is
 * stored as text, so the `instanceof Date` branch is never taken.
 */
function _readTotalQuantityCell(value) {
  if (value == null) return "";
  if (value instanceof Date) {
    var m = value.getMonth() + 1;
    var d = value.getDate();
    return String(m) + MULTI_SEP + String(d);
  }
  return _str(value);
}

function _str(v) {
  return v == null ? "" : String(v);
}

function _num(v) {
  if (v === null || v === undefined || v === "") return "";
  var n = Number(v);
  return isNaN(n) ? "" : n;
}

function _json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  EXAMPLE PAYLOADS  (for reference)
 *
 *  Dynamic, slash-joined cells — one segment per accepted product line,
 *  with NO fixed-slot ceiling. Deterministic ordering: base → upsell →
 *  cross_sell, with insertion order preserved inside each bucket.
 *
 *  ORDER  (initial append — base + 1 cross-sell, no upsell yet)
 *    POST <web-app-url>?apiKey=YOUR_KEY
 *    Content-Type: application/json
 *
 *    {
 *      "kind": "order",
 *      "orderId": "cod_lq7xv2_a1b2c3",
 *      "orderDate": "11/05/2026",
 *      "country": "KSA",
 *      "fullName": "محمد العتيبي",
 *      "phone": "966512345678",
 *      "fullAddress": "الرياض — حي النخيل، شارع الأمير محمد بن سعد",
 *      "productUrl": "https://elfanaa.com/sugarbear/https://elfanaa.com/products/barrier-cream",
 *      "sku": "FN-SUG-004/FN-CREAM-002",
 *      "productName": "فيتامينات سوجاربير للشعر/كريم ترميم الحاجز",
 *      "totalQuantity": "1/3",
 *      "variantPrice": 199,
 *      "currency": "SAR"
 *    }
 *
 *  ORDER_UPDATE  (after 2 upsells accepted — full-state rewrite)
 *    POST <web-app-url>?apiKey=YOUR_KEY
 *    Content-Type: application/json
 *
 *    {
 *      "kind": "order_update",
 *      "orderId": "cod_lq7xv2_a1b2c3",
 *      "productUrl": "https://elfanaa.com/sugarbear/https://elfanaa.com/products/hair-mask/https://elfanaa.com/products/glow-serum/https://elfanaa.com/products/barrier-cream",
 *      "sku": "FN-SUG-004/FN-HAIRMASK-003/FN-SERUM-001/FN-CREAM-002",
 *      "productName": "فيتامينات سوجاربير للشعر/قناع الترميم العميق/سيروم الإشراق/كريم ترميم الحاجز",
 *      "totalQuantity": "1/1/1/3",
 *      "variantPrice": 397,
 *      "currency": "SAR"
 *    }
 *
 *  RESULT in the sheet — single row, atomically rewritten:
 *    SKU             FN-SUG-004/FN-HAIRMASK-003/FN-SERUM-001/FN-CREAM-002
 *    Product name    فيتامينات سوجاربير للشعر/قناع الترميم العميق/سيروم الإشراق/كريم ترميم الحاجز
 *    Total quantity  1/1/1/3
 *    Variant price   397
 *
 *  UPSELL  (LEGACY — kept for backward compat with single-tier fallback;
 *           new code paths must send `order_update` instead so 2+ upsells
 *           don't truncate to the historical 3-slot row):
 *    POST <web-app-url>?apiKey=YOUR_KEY
 *    Content-Type: application/json
 *
 *    {
 *      "kind": "upsell",
 *      "orderId": "cod_lq7xv2_a1b2c3",
 *      "upsellSku": "FN-CREAM-002",
 *      "upsellProductName": "كريم ترميم الحاجز",
 *      "upsellQuantity": 1,
 *      "upsellPrice": 99,
 *      "currency": "SAR"
 *    }
 * ──────────────────────────────────────────────────────────────────────── */
