import { z } from "zod";

/**
 * Multi-tier offer / pricing-pack schema (Phase B4).
 *
 * # Why structured offers
 *
 * The M9 intake captures a single `priceHint.amount` — the
 * publisher's offer-builder later turns it into a 1/2/3-pack
 * ladder via a default markdown curve. That defaults-driven
 * approach is fine for category-aware drops but misses the
 * merchandising leverage operators actually want:
 *
 *   • Pack labels (e.g. "Refill 2-Pack", "Buy 3 Get 1 Free").
 *   • Custom bundle prices that beat a flat markdown curve.
 *   • An explicit "Most Popular" tag to drive the assemble
 *     stage's `offer.recommended` flag without guessing.
 *
 * Capturing offers structurally at intake means:
 *
 *   1. The data is preserved in `intakeMetadata.offers` on every
 *      `IngestJob` for the worker / publisher to read in future
 *      enhancements (Phase C / D will wire this into the
 *      assemble stage's offer construction).
 *   2. Operators get a live "per-unit / savings / margin" preview
 *      while building offers — the same data is RIGHT THERE in
 *      the form, no separate pricing tool needed.
 *
 * # What we DO NOT do in Phase B4 (deliberate)
 *
 * Wiring the offers into the AI pipeline's prompts or the
 * publisher's offer-ladder synthesis is OUT OF SCOPE here per
 * the Phase B non-regression constraint. The offer array flows
 * through to the worker as metadata; the worker continues to
 * derive its offer ladder from `priceHint.amount` as it does
 * today. Phase C work will plumb `intakeMetadata.offers` into
 * the assemble stage.
 *
 * # Units
 *
 * `bundlePrice` is in MAJOR units of the form's chosen currency
 * (same convention as the cost-breakdown fields). Per-unit
 * price is DERIVED (`bundlePrice / quantity`), never stored —
 * derivation lives in the UI helper and the future assemble
 * adapter.
 *
 * # Constraints
 *
 *   • Up to 10 tiers (matches the publisher's existing offer
 *     ladder cap).
 *   • `quantity` is 1-99 (a 100-pack is almost certainly a
 *     units mistake).
 *   • `bundlePrice` capped at 10,000,000 major units (same
 *     order-of-magnitude guard as the cost breakdown).
 *   • At most ONE tier may carry `mostPopular: true` — enforced
 *     by the `.refine()` below.
 *   • Labels are 1-80 chars (room for "Buy 2 Get 1 Free" but
 *     not for run-on operator notes).
 */

export const OfferTierSchema = z.object({
  /** Optional client-side identifier used as a React key. Not
   *  meaningful to the worker; the schema accepts a fresh value
   *  on every submit. */
  id: z.string().min(1).max(64).optional(),
  /** Customer-facing label: "Single", "2-Pack", "Buy 3 Get 1 Free". */
  label: z.string().min(1).max(80),
  /** Units bundled into this tier. 1 for single. */
  quantity: z.number().int().positive().max(99),
  /** Total price for the bundle in MAJOR currency units. */
  bundlePrice: z.number().nonnegative().max(10_000_000),
  /** When true, the assemble stage's UI badge / sort surfaces
   *  this tier as the recommended pick. At most one tier may
   *  carry the flag. */
  mostPopular: z.boolean().optional(),
});

export type OfferTier = z.infer<typeof OfferTierSchema>;

/**
 * Array wrapper with the "at most one mostPopular" invariant.
 * Used as `IntakeMetadataSchema.offers` — fully optional, empty
 * arrays acceptable (semantically equivalent to "no structured
 * offers; fall back to the publisher's default ladder").
 */
export const OffersSchema = z
  .array(OfferTierSchema)
  .max(10)
  .refine(
    (offers) => offers.filter((o) => o.mostPopular === true).length <= 1,
    { message: "at_most_one_offer_may_be_most_popular" },
  );

export type Offers = z.infer<typeof OffersSchema>;
