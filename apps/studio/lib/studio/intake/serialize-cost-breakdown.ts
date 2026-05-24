// Deep-import the metadata subpath — bundled with `IntakeForm`
// (client). The root barrel drags `node:fs` into the browser
// chunk and breaks `next build`.
import type { CostBreakdown } from "@platform/ingest/metadata";

/**
 * Render a structured `CostBreakdown` plus operator's freeform
 * margin notes as a single string suitable for the legacy
 * `marginNotes` field on `IngestJob`.
 *
 * # Why serialise down
 *
 * `marginNotes` is read at the assemble stage and stored verbatim
 * on `UniversalProduct.marginNotes`. Operators reference it
 * post-publish as an internal cost memo. The structured fields
 * give the form a richer authoring experience; the serialised
 * string preserves the contract the assemble stage already
 * consumes — no downstream code changes.
 *
 * # Why we compute landed cost here too
 *
 * The serialiser knows the component fields, so it produces the
 * sum (`landed cost`) for free — making the assemble stage's
 * stored memo immediately useful when an operator audits margins
 * later. The UI also shows it live (the same helper is reused).
 *
 * # Output format
 *
 *     Cost breakdown (per unit):
 *     • Product: 4.20 USD
 *     • Shipping: 1.80 USD
 *     • COD fee: 0.50 USD
 *     • Packaging: 0.30 USD
 *     • Landed cost: 6.80 USD
 *     • Target margin: 35%
 *
 *     Notes: <operator's freeform text>
 *
 * Lines are emitted only for populated fields. Empty input →
 * empty string (form omits `marginNotes`).
 */
export function renderCostBreakdownAsNotes(
  breakdown: CostBreakdown | undefined,
  currency: string,
  freeformNotes: string | undefined,
): string {
  const bullets: string[] = [];
  if (typeof breakdown?.productCost === "number") {
    bullets.push(`• Product: ${fmtCurrency(breakdown.productCost, currency)}`);
  }
  if (typeof breakdown?.shipping === "number") {
    bullets.push(`• Shipping: ${fmtCurrency(breakdown.shipping, currency)}`);
  }
  if (typeof breakdown?.codFee === "number") {
    bullets.push(`• COD fee: ${fmtCurrency(breakdown.codFee, currency)}`);
  }
  if (typeof breakdown?.packaging === "number") {
    bullets.push(`• Packaging: ${fmtCurrency(breakdown.packaging, currency)}`);
  }
  // Landed cost emitted only when at least one component is set —
  // a zero landed cost from an empty breakdown is meaningless.
  const landed = computeLandedCost(breakdown);
  if (landed !== null) {
    bullets.push(`• Landed cost: ${fmtCurrency(landed, currency)}`);
  }
  if (typeof breakdown?.targetMarginPercent === "number") {
    bullets.push(
      `• Target margin: ${breakdown.targetMarginPercent.toFixed(0)}%`,
    );
  }

  const trimmedFreeform = (freeformNotes ?? "").trim();

  if (bullets.length === 0 && !trimmedFreeform) return "";

  const parts: string[] = [];
  if (bullets.length > 0) {
    parts.push("Cost breakdown (per unit):\n" + bullets.join("\n"));
  }
  if (trimmedFreeform) {
    parts.push("Notes: " + trimmedFreeform);
  }
  return parts.join("\n\n");
}

/**
 * Sum the populated cost components. Returns `null` when NO
 * component is set, so callers can suppress the "Landed cost"
 * bullet entirely rather than emit a misleading 0.
 *
 * Exported so the UI's live "landed cost / margin" preview uses
 * the SAME formula as the serialised string.
 */
export function computeLandedCost(
  breakdown: CostBreakdown | undefined,
): number | null {
  if (!breakdown) return null;
  const components: number[] = [];
  if (typeof breakdown.productCost === "number") components.push(breakdown.productCost);
  if (typeof breakdown.shipping === "number") components.push(breakdown.shipping);
  if (typeof breakdown.codFee === "number") components.push(breakdown.codFee);
  if (typeof breakdown.packaging === "number") components.push(breakdown.packaging);
  if (components.length === 0) return null;
  return components.reduce((a, b) => a + b, 0);
}

/**
 * Compute the realised margin % given a price hint and the
 * landed cost. Returns `null` when either input is missing OR
 * when price ≤ 0 (avoids division-by-zero and nonsense negative
 * margins on bad inputs). Otherwise the standard
 * `(price - cost) / price * 100` formula.
 */
export function computeRealisedMarginPercent(
  priceMajor: number | null | undefined,
  landedCost: number | null,
): number | null {
  if (
    typeof priceMajor !== "number" ||
    landedCost === null ||
    priceMajor <= 0
  ) {
    return null;
  }
  return ((priceMajor - landedCost) / priceMajor) * 100;
}

function fmtCurrency(amount: number, currency: string): string {
  // 2 decimals is correct for SAR/AED/USD/QAR; for 3-decimal
  // currencies (KWD/BHD/OMR) operators typically still think in
  // 2 decimals at the input level, so we display 2 here too. A
  // future refinement can read the minorUnitsExponent from
  // `currencies.ts` and switch to 3 — out of scope for B3.
  return `${amount.toFixed(2)} ${currency}`;
}
