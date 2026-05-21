import type { Money, FanaaOfferTier } from "@platform/catalog-schema";

/**
 * Offer-tier expansion — `priceHint` → Fanaa volume-pricing bundle.
 *
 * # Why
 *
 * `UniversalProduct.priceHint` is a single unit price. The Fanaa
 * storefront expects `offerTiers` (1=199, 2=279, 3=349) for its
 * volume-pricing CRO badge ("buy 3 save 22%"). Other publishers
 * (Shopify, TikTok) ignore offerTiers entirely — they belong in
 * `FanaaProductExtension`, not in the universal schema.
 *
 * # Strategy
 *
 * Three-tier ladder, conservative discounts so the highest tier
 * doesn't trigger ad-platform "too cheap" flags:
 *
 *   • qty=1 → priceHint                             (no discount)
 *   • qty=2 → priceHint × 2 × 0.85   (15% off)
 *   • qty=3 → priceHint × 3 × 0.77   (23% off)
 *
 * Totals are LINE totals (matches `apps/fanaa/lib/pricing.ts` shape).
 * Rounded to the nearest minor unit. Currency mirrors `priceHint`.
 *
 * # Why deterministic?
 *
 * Replay-safe publishing demands deterministic tier expansion. Any
 * future "smart pricing" logic (margin-aware, AB-tested) goes in a
 * separate stage that operates on the published bundle, NOT here.
 */
export function deriveOfferTiers(priceHint: Money): FanaaOfferTier[] {
  if (priceHint.amount <= 0) return [];

  const tier1: FanaaOfferTier = {
    quantity: 1,
    total: { amount: priceHint.amount, currency: priceHint.currency },
  };
  const tier2: FanaaOfferTier = {
    quantity: 2,
    total: {
      amount: roundedLineTotal(priceHint.amount, 2, 0.85),
      currency: priceHint.currency,
    },
  };
  const tier3: FanaaOfferTier = {
    quantity: 3,
    total: {
      amount: roundedLineTotal(priceHint.amount, 3, 0.77),
      currency: priceHint.currency,
    },
  };

  return [tier1, tier2, tier3];
}

function roundedLineTotal(
  unitMinor: number,
  qty: number,
  discountFactor: number,
): number {
  return Math.round(unitMinor * qty * discountFactor);
}
