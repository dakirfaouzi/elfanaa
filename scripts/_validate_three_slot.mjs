// Standalone validation for the 3-slot Sheets formatter.
// Run with: `node scripts/_validate_three_slot.mjs`
// Re-implements `buildThreeSlotRow` from `lib/webhooks/google-sheets.ts`
// inline so the script has zero TS dependencies; the two implementations
// must stay in sync.

const SLOT_INNER_SEP = " + ";

function buildThreeSlotRow(lines) {
  const buckets = { base: [], upsell: [], cross_sell: [] };
  for (const line of lines) buckets[line.source].push(line);

  const slot = (key) => {
    const items = buckets[key];
    if (items.length === 0) return { sku: "", name: "", quantity: 0 };
    return {
      sku: items.map((it) => it.sku).filter(Boolean).join(SLOT_INNER_SEP),
      name: items.map((it) => it.name).filter(Boolean).join(SLOT_INNER_SEP),
      quantity: items.reduce((a, it) => a + (it.quantity || 0), 0),
    };
  };
  const b = slot("base"), u = slot("upsell"), c = slot("cross_sell");
  return {
    sku: [b.sku, u.sku, c.sku].join("/"),
    productName: [b.name, u.name, c.name].join("/"),
    totalQuantity: [b.quantity, u.quantity, c.quantity].join("/"),
  };
}

// Apps Script helper — re-implemented for legacy padding validation.
const MULTI_SEP = "/";
function replaceSlot(existing, slotIndex, value, emptyFill) {
  const fill = emptyFill == null ? "" : emptyFill;
  let parts = String(existing == null ? "" : existing).split(MULTI_SEP);
  while (parts.length < 3) parts.push(fill);
  if (parts.length > 3) parts = parts.slice(0, 3);
  for (let i = 0; i < 3; i++) {
    if (parts[i] === "" || parts[i] == null) parts[i] = fill;
  }
  const replacement = value == null || value === "" ? fill : String(value);
  parts[slotIndex] = replacement;
  return parts.join(MULTI_SEP);
}

let passed = 0;
let failed = 0;
function expect(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}`);
    console.log(`      expected: ${JSON.stringify(expected)}`);
    console.log(`      actual:   ${JSON.stringify(actual)}`);
  }
}

console.log("\nbuildThreeSlotRow — slot bucketing");

expect(
  "Sugarbear x3, no cross-sell  →  '3/0/0'",
  buildThreeSlotRow([{ sku: "FN-SUG-004", name: "سوجاربير", quantity: 3, source: "base" }]),
  { sku: "FN-SUG-004//", productName: "سوجاربير//", totalQuantity: "3/0/0" }
);

expect(
  "Sugarbear x1 + cross-sell x3  →  '1/0/3'",
  buildThreeSlotRow([
    { sku: "FN-SUG-004", name: "سوجاربير", quantity: 1, source: "base" },
    { sku: "FN-CREAM-002", name: "كريم", quantity: 3, source: "cross_sell" },
  ]),
  {
    sku: "FN-SUG-004//FN-CREAM-002",
    productName: "سوجاربير//كريم",
    totalQuantity: "1/0/3",
  }
);

expect(
  "Base x2 + Upsell + Cross x2  →  '2/1/2'",
  buildThreeSlotRow([
    { sku: "FN-SUG-004", name: "سوجاربير", quantity: 2, source: "base" },
    { sku: "FN-UPS-99", name: "أوبسل", quantity: 1, source: "upsell" },
    { sku: "FN-CRS-001", name: "كروس", quantity: 2, source: "cross_sell" },
  ]),
  { sku: "FN-SUG-004/FN-UPS-99/FN-CRS-001", productName: "سوجاربير/أوبسل/كروس", totalQuantity: "2/1/2" }
);

expect(
  "Base x1 + Upsell x1 + Cross x3  →  '1/1/3'  (user's stated example)",
  buildThreeSlotRow([
    { sku: "A", name: "Base", quantity: 1, source: "base" },
    { sku: "B", name: "Up", quantity: 1, source: "upsell" },
    { sku: "C", name: "Cross", quantity: 3, source: "cross_sell" },
  ]),
  { sku: "A/B/C", productName: "Base/Up/Cross", totalQuantity: "1/1/3" }
);

expect(
  "Multi-base (Sugarbear x2 + GlowSerum x1)  →  base slot joins with ' + '",
  buildThreeSlotRow([
    { sku: "FN-SUG-004", name: "سوجاربير", quantity: 2, source: "base" },
    { sku: "FN-GLO-001", name: "Glow Serum", quantity: 1, source: "base" },
  ]),
  {
    sku: "FN-SUG-004 + FN-GLO-001//",
    productName: "سوجاربير + Glow Serum//",
    totalQuantity: "3/0/0",
  }
);

expect(
  "Empty cart  →  '0/0/0' all empty",
  buildThreeSlotRow([]),
  { sku: "//", productName: "//", totalQuantity: "0/0/0" }
);

console.log("\nreplaceSlot — Apps Script upsell-merge legacy padding");

expect(
  "Legacy '3' + upsell 1   →  '3/1/0'",
  replaceSlot("3", 1, "1", "0"),
  "3/1/0"
);
expect(
  "Legacy '3/2' + upsell 1   →  '3/1/0' (replaces middle, 3rd backfilled)",
  replaceSlot("3/2", 1, "1", "0"),
  "3/1/0"
);
expect(
  "Already 3-slot '3/0/0' + upsell 1   →  '3/1/0'",
  replaceSlot("3/0/0", 1, "1", "0"),
  "3/1/0"
);
expect(
  "Cross-only base '0/0/3' + upsell 1   →  '0/1/3'",
  replaceSlot("0/0/3", 1, "1", "0"),
  "0/1/3"
);
expect(
  "SKU slot for legacy 'FN-SUG' + upsell SKU 'FN-CRM'  →  'FN-SUG/FN-CRM/'",
  replaceSlot("FN-SUG", 1, "FN-CRM", ""),
  "FN-SUG/FN-CRM/"
);
expect(
  "Already 3-slot SKU 'FN-SUG//FN-CRS' + upsell SKU 'FN-CRM'  →  'FN-SUG/FN-CRM/FN-CRS'",
  replaceSlot("FN-SUG//FN-CRS", 1, "FN-CRM", ""),
  "FN-SUG/FN-CRM/FN-CRS"
);
expect(
  "Empty existing '' + upsell SKU 'X'  →  '/X/'",
  replaceSlot("", 1, "X", ""),
  "/X/"
);

console.log("");
console.log(`Result: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
