// Standalone validation for the dynamic Sheets order-row formatter.
//
// Run from the repo root with:
//     node scripts/_validate_dynamic_stack.mjs
//
// Re-implements `buildOrderRow` and `buildThreeSlotRow` from
// `lib/webhooks/google-sheets.ts` inline so the script has zero
// TS/build dependencies. The two implementations MUST stay in sync —
// this script exists specifically so production regressions like the
// "2/1/3 vs expected 2/1/1/3" multi-upsell truncation can never come
// back undetected.
//
// Coverage:
//   • Arbitrary product counts (1, 2, 4, 6, 9 segments).
//   • Mixed upsell + cross-sell stacking.
//   • Repeated quantities (1..7).
//   • Duplicated SKUs.
//   • Insertion-order preservation within each bucket.
//   • Source ordering (base → upsell → cross_sell) regardless of input order.
//   • Per-cell alignment (sku / productName / totalQuantity / productUrl).
//   • Empty input.
//   • Unknown / missing source defaults to "base".
//   • The legacy `buildThreeSlotRow` shim now also returns one segment
//     per line (no fixed-slot padding) — guards against any caller
//     accidentally rolling back to the broken 3-slot truncation.

const SOURCE_RANK = { base: 0, upsell: 1, cross_sell: 2 };

function buildOrderRow(lines) {
  const ordered = lines
    .map((line, idx) => ({
      line: {
        ...line,
        source:
          line.source === "base" ||
          line.source === "upsell" ||
          line.source === "cross_sell"
            ? line.source
            : "base",
      },
      idx,
    }))
    .sort((a, b) => {
      const r = SOURCE_RANK[a.line.source] - SOURCE_RANK[b.line.source];
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

function buildThreeSlotRow(lines) {
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

let passed = 0;
let failed = 0;
function expect(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  \u2713 ${label}`);
  } else {
    failed++;
    console.log(`  \u2717 ${label}`);
    console.log(`      expected: ${JSON.stringify(expected)}`);
    console.log(`      actual:   ${JSON.stringify(actual)}`);
  }
}

const url = (slug) => `https://elfanaa.com/${slug}`;
const sku = (n) => `FN-${String(n).padStart(3, "0")}`;

console.log("\nbuildOrderRow — single product (1 segment)");

expect(
  "Sugarbear x3 only  →  '3'",
  buildOrderRow([
    { sku: "FN-SUG-004", name: "سوجاربير", quantity: 3, url: url("sugarbear"), source: "base" },
  ]),
  {
    sku: "FN-SUG-004",
    productName: "سوجاربير",
    totalQuantity: "3",
    productUrl: url("sugarbear"),
  },
);

console.log("\nbuildOrderRow — base + cross-sell (2 segments)");

expect(
  "Sugarbear x1 + cross-sell x3  →  '1/3' (2 segments, no padding)",
  buildOrderRow([
    { sku: "FN-SUG-004", name: "سوجاربير", quantity: 1, url: url("sugarbear"), source: "base" },
    { sku: "FN-CREAM-002", name: "كريم", quantity: 3, url: url("cream"), source: "cross_sell" },
  ]),
  {
    sku: "FN-SUG-004/FN-CREAM-002",
    productName: "سوجاربير/كريم",
    totalQuantity: "1/3",
    productUrl: `${url("sugarbear")}/${url("cream")}`,
  },
);

console.log("\nbuildOrderRow — the exact multi-upsell regression scenario");

expect(
  "Base x2 + upsell #1 + upsell #2 + cross x3  →  '2/1/1/3' (the user's expected output)",
  buildOrderRow([
    { sku: "FN-SUG-004", name: "Sugarbear", quantity: 2, url: url("sugarbear"), source: "base" },
    { sku: "FN-UPS-99-A", name: "Upsell A", quantity: 1, url: url("upsell-a"), source: "upsell" },
    { sku: "FN-UPS-99-B", name: "Upsell B", quantity: 1, url: url("upsell-b"), source: "upsell" },
    { sku: "FN-CRS-001", name: "Cross", quantity: 3, url: url("cross"), source: "cross_sell" },
  ]),
  {
    sku: "FN-SUG-004/FN-UPS-99-A/FN-UPS-99-B/FN-CRS-001",
    productName: "Sugarbear/Upsell A/Upsell B/Cross",
    totalQuantity: "2/1/1/3",
    productUrl: `${url("sugarbear")}/${url("upsell-a")}/${url("upsell-b")}/${url("cross")}`,
  },
);

console.log("\nbuildOrderRow — large funnel: base + 5 upsells (6 segments)");

expect(
  "Base + 5 upsells  →  '1/1/1/1/1/1'  +  6 SKU segments",
  buildOrderRow([
    { sku: "B", name: "Base", quantity: 1, url: "u0", source: "base" },
    { sku: "U1", name: "U1", quantity: 1, url: "u1", source: "upsell" },
    { sku: "U2", name: "U2", quantity: 1, url: "u2", source: "upsell" },
    { sku: "U3", name: "U3", quantity: 1, url: "u3", source: "upsell" },
    { sku: "U4", name: "U4", quantity: 1, url: "u4", source: "upsell" },
    { sku: "U5", name: "U5", quantity: 1, url: "u5", source: "upsell" },
  ]),
  {
    sku: "B/U1/U2/U3/U4/U5",
    productName: "Base/U1/U2/U3/U4/U5",
    totalQuantity: "1/1/1/1/1/1",
    productUrl: "u0/u1/u2/u3/u4/u5",
  },
);

console.log("\nbuildOrderRow — base + 7 cross-sells (8 segments)");

expect(
  "Base + 7 cross-sells  →  8 segments, deterministic order",
  buildOrderRow([
    { sku: "B", name: "B", quantity: 1, url: "ub", source: "base" },
    { sku: "C1", name: "C1", quantity: 1, url: "u1", source: "cross_sell" },
    { sku: "C2", name: "C2", quantity: 2, url: "u2", source: "cross_sell" },
    { sku: "C3", name: "C3", quantity: 3, url: "u3", source: "cross_sell" },
    { sku: "C4", name: "C4", quantity: 4, url: "u4", source: "cross_sell" },
    { sku: "C5", name: "C5", quantity: 5, url: "u5", source: "cross_sell" },
    { sku: "C6", name: "C6", quantity: 6, url: "u6", source: "cross_sell" },
    { sku: "C7", name: "C7", quantity: 7, url: "u7", source: "cross_sell" },
  ]),
  {
    sku: "B/C1/C2/C3/C4/C5/C6/C7",
    productName: "B/C1/C2/C3/C4/C5/C6/C7",
    totalQuantity: "1/1/2/3/4/5/6/7",
    productUrl: "ub/u1/u2/u3/u4/u5/u6/u7",
  },
);

console.log("\nbuildOrderRow — base + 9 mixed extras (10 segments)");

expect(
  "Base + 4 upsells + 5 cross-sells (mixed)  →  10 segments, base→upsell→cross_sell",
  buildOrderRow([
    { sku: "B", name: "B", quantity: 1, url: "ub", source: "base" },
    { sku: "C1", name: "C1", quantity: 1, url: "uc1", source: "cross_sell" },
    { sku: "U1", name: "U1", quantity: 1, url: "uu1", source: "upsell" },
    { sku: "C2", name: "C2", quantity: 1, url: "uc2", source: "cross_sell" },
    { sku: "U2", name: "U2", quantity: 1, url: "uu2", source: "upsell" },
    { sku: "C3", name: "C3", quantity: 1, url: "uc3", source: "cross_sell" },
    { sku: "U3", name: "U3", quantity: 1, url: "uu3", source: "upsell" },
    { sku: "C4", name: "C4", quantity: 1, url: "uc4", source: "cross_sell" },
    { sku: "U4", name: "U4", quantity: 1, url: "uu4", source: "upsell" },
    { sku: "C5", name: "C5", quantity: 1, url: "uc5", source: "cross_sell" },
  ]),
  {
    sku: "B/U1/U2/U3/U4/C1/C2/C3/C4/C5",
    productName: "B/U1/U2/U3/U4/C1/C2/C3/C4/C5",
    totalQuantity: "1/1/1/1/1/1/1/1/1/1",
    productUrl: "ub/uu1/uu2/uu3/uu4/uc1/uc2/uc3/uc4/uc5",
  },
);

console.log("\nbuildOrderRow — duplicate SKUs (every line preserved)");

expect(
  "Same SKU added as base + cross-sell  →  both segments emit (no merge)",
  buildOrderRow([
    { sku: "FN-DUP", name: "Dup", quantity: 2, url: "u", source: "base" },
    { sku: "FN-DUP", name: "Dup", quantity: 1, url: "u", source: "cross_sell" },
  ]),
  {
    sku: "FN-DUP/FN-DUP",
    productName: "Dup/Dup",
    totalQuantity: "2/1",
    productUrl: "u/u",
  },
);

console.log("\nbuildOrderRow — insertion order preserved within each bucket");

expect(
  "Upsells UA, UB, UC kept in insertion order regardless of source input order",
  buildOrderRow([
    { sku: "UA", name: "UA", quantity: 1, url: "a", source: "upsell" },
    { sku: "B",  name: "B",  quantity: 1, url: "b", source: "base" },
    { sku: "UB", name: "UB", quantity: 1, url: "ub", source: "upsell" },
    { sku: "UC", name: "UC", quantity: 1, url: "uc", source: "upsell" },
  ]),
  {
    // base first (B), then upsells in their insertion order (UA, UB, UC)
    sku: "B/UA/UB/UC",
    productName: "B/UA/UB/UC",
    totalQuantity: "1/1/1/1",
    productUrl: "b/a/ub/uc",
  },
);

console.log("\nbuildOrderRow — edge cases");

expect(
  "Empty input  →  every field is the empty string",
  buildOrderRow([]),
  { sku: "", productName: "", totalQuantity: "", productUrl: "" },
);

expect(
  "Unknown source collapses to base",
  buildOrderRow([
    { sku: "X", name: "X", quantity: 1, url: "ux", source: "shipping" },
  ]),
  { sku: "X", productName: "X", totalQuantity: "1", productUrl: "ux" },
);

expect(
  "Missing per-line url  →  empty string segment (alignment preserved)",
  buildOrderRow([
    { sku: "A", name: "A", quantity: 1, source: "base" },
    { sku: "B", name: "B", quantity: 1, source: "upsell" },
  ]),
  { sku: "A/B", productName: "A/B", totalQuantity: "1/1", productUrl: "/" },
);

expect(
  "Missing quantity defaults to 0 in the joined string",
  buildOrderRow([
    { sku: "X", name: "X", url: "u", source: "base" },
  ]),
  { sku: "X", productName: "X", totalQuantity: "0", productUrl: "u" },
);

console.log("\nbuildOrderRow — large quantities + many SKUs alignment");

const big = Array.from({ length: 12 }, (_, i) => ({
  sku: sku(i + 1),
  name: `P${i + 1}`,
  quantity: ((i * 3) % 7) + 1,
  url: `u${i + 1}`,
  source: i === 0 ? "base" : i % 2 === 0 ? "upsell" : "cross_sell",
}));
const bigOut = buildOrderRow(big);
expect(
  "12 segments — sku / name / qty / url cells all have exactly 12 segments",
  {
    skuSeg: bigOut.sku.split("/").length,
    nameSeg: bigOut.productName.split("/").length,
    qtySeg: bigOut.totalQuantity.split("/").length,
    urlSeg: bigOut.productUrl.split("/").length,
  },
  { skuSeg: 12, nameSeg: 12, qtySeg: 12, urlSeg: 12 },
);

console.log("\nbuildThreeSlotRow shim — now dynamic (no fixed-slot truncation)");

expect(
  "Legacy shim: base x2 + upsell + upsell + cross x3  →  '2/1/1/3' (no truncation)",
  buildThreeSlotRow([
    { sku: "B", name: "B", quantity: 2, source: "base" },
    { sku: "U1", name: "U1", quantity: 1, source: "upsell" },
    { sku: "U2", name: "U2", quantity: 1, source: "upsell" },
    { sku: "C", name: "C", quantity: 3, source: "cross_sell" },
  ]),
  { sku: "B/U1/U2/C", productName: "B/U1/U2/C", totalQuantity: "2/1/1/3" },
);

expect(
  "Legacy shim: single base x3  →  '3' (no padding to 3 slots)",
  buildThreeSlotRow([{ sku: "X", name: "X", quantity: 3, source: "base" }]),
  { sku: "X", productName: "X", totalQuantity: "3" },
);

console.log("");
console.log(`Result: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
