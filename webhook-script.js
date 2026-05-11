/**
 * ELFANAA — Google Apps Script web app.
 *
 * Single-tab orders ledger. Every COD order placed on ANY product page on
 * the website appends one row here. When the post-purchase upsell is
 * accepted, the same row is updated in-place (SKU / Product name / Total
 * quantity / Variant price gain the upsell, separated by "/") so each row
 * always reflects the FINAL real order.
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

    var kind = body && body.kind === "upsell" ? "upsell" : "order";
    var sheet = _ensureSheet();

    if (kind === "order") {
      return _handleOrder(sheet, body);
    }
    return _handleUpsell(sheet, body);
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

  if (orderId) {
    var lastRow = sheet.getLastRow();
    _rememberOrderRow(orderId, lastRow);
  }
  return _json({ ok: true, kind: "order" });
}

/* ─────────────────────────────────────────────────────────────────────────
 *  UPSELL  —  upsert the original row in place
 *
 *  Apps Script keeps `order:<orderId>` → row index in PropertiesService.
 *  We read the original row, append the upsell SKU / name / quantity to
 *  the existing values (separator "/"), add the upsell price to the
 *  variant_price, and write four cells back. Idempotent — if the same
 *  upsell SKU is already present, no-op.
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
    sheet.appendRow([
      "",
      "KSA",
      "",
      "",
      "",
      "",
      _str(body.upsellSku),
      _str(body.upsellProductName),
      String(body.upsellQuantity || 1),
      _num(body.upsellPrice),
      _str(body.currency) || "SAR",
    ]);
    return _json({ ok: true, kind: "upsell", orphan: true });
  }

  var range = sheet.getRange(rowIdx, 1, 1, HEADERS.length);
  var existing = range.getValues()[0];

  var existingSku = _str(existing[COL.SKU - 1]);
  var upsellSku = _str(body.upsellSku);

  if (upsellSku && existingSku.split(MULTI_SEP).indexOf(upsellSku) !== -1) {
    return _json({ ok: true, kind: "upsell", duplicate: true });
  }

  var newSku = _joinAppend(existingSku, upsellSku);
  var newName = _joinAppend(
    _str(existing[COL.PRODUCT_NAME - 1]),
    _str(body.upsellProductName),
  );
  var existingQty = _str(existing[COL.TOTAL_QUANTITY - 1]);
  var newQty = _joinAppend(existingQty, String(body.upsellQuantity || 1));
  var existingPrice = Number(existing[COL.VARIANT_PRICE - 1]) || 0;
  var newPrice = existingPrice + (Number(body.upsellPrice) || 0);

  sheet.getRange(rowIdx, COL.SKU).setValue(newSku);
  sheet.getRange(rowIdx, COL.PRODUCT_NAME).setValue(newName);
  sheet.getRange(rowIdx, COL.TOTAL_QUANTITY).setValue(newQty);
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
 *  ORDER:
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
 *      "fullAddress": "",
 *      "productUrl": "https://elfanaa.com/sugarbear",
 *      "sku": "FN-SUG-004",
 *      "productName": "فيتامينات سوجاربير للشعر",
 *      "totalQuantity": "3",
 *      "variantPrice": 349,
 *      "currency": "SAR"
 *    }
 *
 *  UPSELL  (updates the row above in place):
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
 *
 *  RESULT in the sheet (single row):
 *    SKU             FN-SUG-004/FN-CREAM-002
 *    Product name    فيتامينات سوجاربير للشعر/كريم ترميم الحاجز
 *    Total quantity  3/1
 *    Variant price   448
 * ──────────────────────────────────────────────────────────────────────── */
