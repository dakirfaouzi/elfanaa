// Deep-import the metadata subpath — bundled with `OfferBuilder`
// (client). The root barrel drags `node:fs` into the browser
// chunk and breaks `next build`.
import type { OfferTier } from "@platform/ingest/metadata";

/**
 * Pure derivation helpers for the offer builder's live preview
 * (Phase B4).
 *
 * # Why these are separate from the component
 *
 * The component re-renders on every keystroke and runs the same
 * math against the offer array. Extracting it into a pure module:
 *
 *   1. Lets unit tests pin the math (a UI snapshot test would
 *      lock the markup too).
 *   2. Lets future Phase C code (assemble-stage adapter) reuse
 *      the SAME formulas the operator saw in the form — no
 *      drift between intake preview and runtime calculation.
 *
 * # Definitions
 *
 *   • `perUnit`        = `bundlePrice / quantity`.
 *                        The price the customer effectively pays
 *                        per unit at this tier.
 *   • `landedCostFor`  = `landedCost * quantity`. The COGS for
 *                        fulfilling one bundle of this tier.
 *   • `marginPercent`  = `(bundlePrice - landedCostFor) / bundlePrice * 100`.
 *                        Returns null when landedCost is unknown
 *                        OR when bundlePrice ≤ 0.
 *   • `savingsPercent` = vs the BASELINE per-unit price. The
 *                        baseline is the tier with `quantity = 1`,
 *                        OR (if no single-unit tier) the priceHint
 *                        major value. Returns null when there's
 *                        no baseline to compare against.
 *
 * # AOV (Average Order Value)
 *
 * `mostPopularTier()` returns the tier flagged `mostPopular`
 * — if present, the form uses its `bundlePrice` as the
 * "estimated AOV" headline stat. When no tier is flagged we
 * fall back to the highest-quantity tier as a heuristic
 * (operators usually push the biggest pack as the upsell).
 */

export function pricePerUnit(tier: OfferTier): number {
  if (tier.quantity <= 0) return 0;
  return tier.bundlePrice / tier.quantity;
}

export function bundleMarginPercent(
  tier: OfferTier,
  landedCostPerUnit: number | null,
): number | null {
  if (landedCostPerUnit === null) return null;
  if (tier.bundlePrice <= 0) return null;
  const cogs = landedCostPerUnit * tier.quantity;
  return ((tier.bundlePrice - cogs) / tier.bundlePrice) * 100;
}

/**
 * Baseline per-unit price for savings %. Prefers the explicit
 * single-unit tier; falls back to `priceHintMajor` so the
 * operator gets a savings cue immediately while they're still
 * sketching the ladder.
 */
export function baselinePerUnit(
  offers: OfferTier[],
  priceHintMajor: number | null,
): number | null {
  const singleTier = offers.find((o) => o.quantity === 1);
  if (singleTier && singleTier.bundlePrice > 0) {
    return singleTier.bundlePrice;
  }
  if (typeof priceHintMajor === "number" && priceHintMajor > 0) {
    return priceHintMajor;
  }
  return null;
}

export function savingsPercentVsBaseline(
  tier: OfferTier,
  baseline: number | null,
): number | null {
  if (baseline === null || baseline <= 0) return null;
  if (tier.quantity <= 0) return null;
  const perUnit = pricePerUnit(tier);
  if (perUnit <= 0) return null;
  return ((baseline - perUnit) / baseline) * 100;
}

/**
 * The headline-AOV tier:
 *   1. The tier flagged `mostPopular`, OR
 *   2. The largest-quantity tier (operator's implicit upsell), OR
 *   3. null when offers is empty.
 *
 * The form's preview uses this tier's `bundlePrice` as the
 * "Estimated AOV" stat.
 */
export function mostPopularTier(offers: OfferTier[]): OfferTier | null {
  if (offers.length === 0) return null;
  const flagged = offers.find((o) => o.mostPopular === true);
  if (flagged) return flagged;
  return [...offers].sort((a, b) => b.quantity - a.quantity)[0] ?? null;
}
