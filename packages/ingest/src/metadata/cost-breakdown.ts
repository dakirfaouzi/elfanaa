import { z } from "zod";

/**
 * Structured operator-internal cost breakdown (Phase B3).
 *
 * # Why structured instead of free-text
 *
 * The M9 intake's `marginNotes` is a single string ("supplier
 * $4.20 + ship $1.80"). It works as a memo but:
 *
 *   • The assemble stage stores the string verbatim on
 *     `UniversalProduct.marginNotes` for the operator's later
 *     reference — no math is done with it.
 *   • Computing aggregate margin / break-even across drafts is
 *     impossible without parsing the free-text.
 *   • Operators consistently forget components (e.g. COD fee in
 *     GCC markets, which routinely runs 2-3% of order total).
 *
 * Structured fields capture each component as a NUMBER so the
 * UI can compute live "landed cost" and "margin at price hint"
 * and so the strategy stage's prompt sees a clean labelled
 * block instead of a freeform note.
 *
 * # Units
 *
 * Major units of the operator's chosen currency. The validator's
 * MAJOR→MINOR conversion (used for `priceHint.amount`) is
 * deliberately NOT applied here:
 *
 *   1. These numbers never feed Money math — they exist only to
 *      serialise INTO `marginNotes` (string) for Claude's
 *      strategy prompt and operator reference.
 *   2. Operators think in major units when planning margins.
 *      Asking for "cents" on the form would be hostile UX.
 *
 * The currency comes from the form's currency dropdown
 * (`priceHint.currency`) — the cost-breakdown schema does NOT
 * embed currency to avoid drift between the two fields.
 *
 * # `targetMarginPercent`
 *
 * Operator's desired margin %, NOT the realised margin. The UI
 * shows realised margin live (priceHint − landed cost) and the
 * delta to the target. The schema caps at 95% — anything higher
 * is almost certainly a units mistake (e.g. accidentally
 * entered priceHintMinor in productCostMajor).
 *
 * # Backward-compat contract
 *
 * Every field optional. Empty object is valid. Form omits the
 * `costBreakdown` namespace entirely when no fields are set, so
 * on-disk run records remain byte-identical to Phase A.
 *
 * The companion serialiser
 * (`apps/studio/lib/studio/intake/serialize-cost-breakdown.ts`)
 * renders the structured fields INTO the existing `marginNotes`
 * string, so the assemble stage's persistence path is unchanged
 * — Phase B is intentionally scope-restricted to intake UX per
 * the non-regression constraint.
 */

export const CostBreakdownSchema = z.object({
  /** Wholesale unit cost from the supplier. */
  productCost: z.number().nonnegative().max(1_000_000).optional(),
  /** Shipping cost per unit (supplier → fulfilment hub OR direct). */
  shipping: z.number().nonnegative().max(1_000_000).optional(),
  /** Cash-on-delivery fee per order (GCC markets routinely 2-3%
   *  of order total — material to true margin). */
  codFee: z.number().nonnegative().max(1_000_000).optional(),
  /** Packaging cost per unit (box + tape + filler + insert). */
  packaging: z.number().nonnegative().max(1_000_000).optional(),
  /** Operator's TARGET margin %. NOT the realised margin —
   *  realised margin is computed live by the UI from
   *  `priceHint − landed_cost`. */
  targetMarginPercent: z.number().min(0).max(95).optional(),
});

export type CostBreakdown = z.infer<typeof CostBreakdownSchema>;
