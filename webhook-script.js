/**
 * ELFANAA — Google Apps Script for the orders Google Sheet.
 *
 * One-time deploy (5 minutes):
 *   1. Create a fresh Google Sheet, name it "ELFANAA · Orders".
 *   2. Open the column headers row from `sheet-template.csv` and paste
 *      it into row 1 of the sheet (Excel/Numbers users can drag-import
 *      the CSV; the headers must match key-for-key with this script).
 *   3. Extensions → Apps Script → paste this whole file → save.
 *   4. Deploy → New deployment → Type: "Web app".
 *        • Execute as: Me
 *        • Who has access: Anyone (the API_KEY below is the gate)
 *      Copy the resulting `…/exec` URL.
 *   5. Set in your `.env` (frontend or backend):
 *        GOOGLE_SHEETS_WEBHOOK_URL=<that URL>
 *        GOOGLE_SHEETS_API_KEY=<the same value as API_KEY below>
 *   6. (Optional) Run `setupHeaders()` once from the Apps Script editor
 *      to auto-populate the header row.
 *
 * Why Apps Script (vs. Sheets API):
 *   • Zero auth ceremony — no service account JSON, no scope wrangling.
 *   • Free for 20k req/day. Plenty for a launch funnel.
 *   • Locks the sheet to your Google account by definition.
 *   • One file, ten lines, never breaks.
 *
 * Security:
 *   • The API key travels as `?apiKey=` in the URL. Apps Script doesn't
 *     run external libraries, so HMAC verification is awkward. The query
 *     param is fine because the sheet is private and the Web App URL is
 *     unguessable. Rotate the key by editing both the sheet AND your env.
 *   • Two destinations: row "kind" `order` is appended to the main tab;
 *     row "kind" `upsell` is appended to a sibling tab so ops can see
 *     base orders and upsells side-by-side without a JOIN.
 */

/* eslint-disable no-undef */

const API_KEY = "REPLACE_WITH_A_LONG_RANDOM_STRING"; // change me + match env

const SHEET_ORDERS = "Orders";
const SHEET_UPSELLS = "Upsells";

// Order matters — these mirror `sheet-template.csv` and the
// `build_sheets_row` function in both the Next.js and FastAPI backends.
const HEADERS = [
  "received_at",
  "order_id",
  "full_name",
  "phone",
  "phone_e164",
  "items",
  "item_count",
  "subtotal_sar",
  "upsell_sar",
  "total_sar",
  "currency",
  "payment_method",
  "locale",
  "source",
];

/**
 * Entry point — Apps Script's `doPost` handler.
 *   POST <webApp>?apiKey=...   {row...}
 */
function doPost(e) {
  try {
    const apiKey = (e && e.parameter && e.parameter.apiKey) || "";
    if (apiKey !== API_KEY) {
      return _json({ ok: false, error: "unauthorized" }, 401);
    }

    var body = {};
    try {
      body = JSON.parse(e.postData.contents);
    } catch (_) {
      return _json({ ok: false, error: "invalid_json" }, 400);
    }

    var kind = body.kind === "upsell" ? "upsell" : "order";
    var sheetName = kind === "upsell" ? SHEET_UPSELLS : SHEET_ORDERS;
    var sheet = _ensureSheet(sheetName);

    var row = HEADERS.map(function (h) {
      return body[h] != null ? body[h] : "";
    });
    sheet.appendRow(row);

    return _json({ ok: true, kind: kind });
  } catch (err) {
    return _json({ ok: false, error: String(err && err.message ? err.message : err) }, 500);
  }
}

/**
 * One-shot setup — populates the header row in both tabs. Run once
 * from the Apps Script editor when you first deploy.
 */
function setupHeaders() {
  [SHEET_ORDERS, SHEET_UPSELLS].forEach(function (name) {
    var sheet = _ensureSheet(name);
    var existing = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    var blank = existing.every(function (v) { return v === "" || v == null; });
    if (blank) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.setFrozenRows(1);
    }
  });
}

/* ─────────────────────────────  helpers ──────────────────────────────── */

function _ensureSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function _json(payload, status) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ─────────────────────────────  example payload ──────────────────────────────

POST <web-app-url>?apiKey=YOUR_KEY
Content-Type: application/json

{
  "kind": "order",
  "received_at": "2026-05-03T16:00:00Z",
  "order_id": "ord_a1b2c3d4e5f6",
  "full_name": "محمد العتيبي",
  "phone": "0512345678",
  "phone_e164": "+966512345678",
  "items": "وسادة مجلس أرضية × 3 (349 SAR)",
  "item_count": 3,
  "subtotal_sar": 349.00,
  "upsell_sar": 99.00,
  "total_sar": 448.00,
  "currency": "SAR",
  "payment_method": "cod",
  "locale": "ar",
  "source": "https://elfanaa.com/products/majlis-floor-cushion"
}

────────────────────────────────────────────────────────────────────────────── */
