/**
 * Post-purchase upsell strategy.
 *
 * One offer. One screen. Fixed price. Smart product selection.
 *
 * The 99 SAR offer is the **only** discount in the entire store. Everywhere
 * else, products carry their honest base price. This keeps the offer rare
 * (and therefore credible) and protects margin on the rest of the catalogue.
 *
 * Selection algorithm — see `selectPostPurchaseUpsell`:
 *
 *   1.  Build the candidate set: every product NOT already in the order,
 *       whose base price falls inside the **anchor-credibility window**
 *       (1.5x–6x of 99 SAR). Below 1.5x and the discount is too small to
 *       feel like a deal; above 6x and a 99 SAR price feels fake.
 *
 *   2.  Score each candidate against the order's product mix:
 *         + 50  curated upsell (in `upsellIds` of any cart item)
 *         + 30  same collection as a cart item
 *         + 20  complementary collection (e.g. living → lighting)
 *         + 10  inside the "ideal" 2x–4x anchor band (best-feeling discount)
 *         +  R  product rating count, log-scaled, as a tiebreaker
 *
 *   3.  Editorial overrides win unconditionally — `editorialOverrides[ id ]`
 *       lets a marketer pin "if cart contains X, force-show Y" without
 *       touching React or restarting the server.
 *
 *   4.  The picked product is repriced to `POST_PURCHASE_OFFER_PRICE` and
 *       returned with the savings (vs base price) computed for display.
 *
 * The function is pure and side-effect-free so it runs identically on the
 * server (`/api/orders` could pre-pick) and on the client (the modal does).
 */

import type { Money, Product } from "@/lib/types";
import { getProductById, products } from "@/data/products";

/* -------------------------------------------------------------------------- */
/*                                 Constants                                   */
/* -------------------------------------------------------------------------- */

/** The single, store-wide offer price (minor units). */
export const POST_PURCHASE_OFFER_PRICE: Money = {
  amount: 9900,
  currency: "SAR",
};

/**
 * Anchor-credibility window: base price must be in [1.5x, 6x] of the offer.
 *
 * For the launch trio (199 SAR base → 99 SAR offer = ratio 2.01) every
 * signature product naturally sits inside the *ideal* band, so the offer
 * always reads as "half off" without us needing to manufacture compare-at
 * pricing. Adjust the bounds if you introduce higher-ticket SKUs later.
 */
const MIN_ANCHOR_RATIO = 1.5;
const MAX_ANCHOR_RATIO = 6;

/** "Ideal" band — discount that *feels* the best (2x–4x of offer). */
const IDEAL_ANCHOR_RATIO_MIN = 2;
const IDEAL_ANCHOR_RATIO_MAX = 4;

/** How long the offer is visible before it auto-declines (per spec: 10–15s). */
export const POST_PURCHASE_TIMER_SECONDS = 12;

/* -------------------------------------------------------------------------- */
/*                            Complementarity map                              */
/* -------------------------------------------------------------------------- */

/**
 * Hand-tuned "products from collection X pair well with Y" map.
 *
 * This deliberately AVOIDS suggesting same-category competitors — Aftersell's
 * common-mistake research: showing a sofa next to a sofa kills relevance.
 * The map encodes editorial taste; treat it as merchandising config, not code.
 */
const COMPLEMENT_MAP: Record<string, string[]> = {
  living: ["lighting", "decor"],
  lighting: ["living", "decor"],
  decor: ["coffee", "lighting"],
  coffee: ["decor"],
  garden: ["lighting", "decor"],
};

/**
 * Editorial overrides — pin a specific upsell for a specific cart product.
 *   `editorialOverrides["p_001"] = "p_002"` means "if cart contains the
 *   majlis cushion, force the courtyard lantern as the post-purchase offer".
 *
 * Keys are productIds in the cart, values are the productId to offer.
 * Looked up before the scoring algorithm runs.
 *
 * For the launch trio: the cushion buyer most often imagines an evening
 * scene → lantern. The lantern buyer is mid-decorating → vase. The vase
 * buyer is styling a quiet corner → cushion. A complete cyclic merchandising
 * map across the three signature products.
 */
const editorialOverrides: Record<string, string> = {
  p_001: "p_002",
  p_002: "p_003",
  p_003: "p_001",
};

/* -------------------------------------------------------------------------- */
/*                              Resolved offer                                 */
/* -------------------------------------------------------------------------- */

export type ResolvedPostPurchaseUpsell = {
  product: Product;
  /** Always equals `POST_PURCHASE_OFFER_PRICE` — kept on the result for ergonomics. */
  offerPrice: Money;
  /** Base price (anchor) — what the product normally costs. */
  basePrice: Money;
  /** Absolute SAR savings vs. base price. */
  savings: Money;
  /** Integer percent off, rounded for display. */
  discountPercent: number;
  /** Score from the algorithm (debug / analytics use). */
  score: number;
  /** Reason tag — useful for analytics + future merchandising audits. */
  reason: "editorial" | "curated" | "complement" | "collection" | "fallback";
};

/* -------------------------------------------------------------------------- */
/*                                Selection                                    */
/* -------------------------------------------------------------------------- */

export function selectPostPurchaseUpsell(
  cartProductIds: string[]
): ResolvedPostPurchaseUpsell | null {
  const inCart = new Set(cartProductIds);
  const cartProducts = cartProductIds
    .map(getProductById)
    .filter((p): p is Product => Boolean(p));

  // 1. Editorial override — first cart item that has a pinned offer wins.
  for (const cartProduct of cartProducts) {
    const pinned = editorialOverrides[cartProduct.id];
    if (!pinned || inCart.has(pinned)) continue;
    const product = getProductById(pinned);
    if (product && isAnchorCredible(product)) {
      return resolve(product, 999, "editorial");
    }
  }

  // 2. Score every credible candidate.
  const candidates = products
    .filter((p) => !inCart.has(p.id))
    .filter(isAnchorCredible)
    .map((product) => {
      const { score, reason } = scoreCandidate(product, cartProducts);
      return { product, score, reason };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  // 3. No candidate matched — fall back to the highest-rated credible product.
  if (candidates.length === 0) {
    const fallback = products
      .filter((p) => !inCart.has(p.id))
      .filter(isAnchorCredible)
      .sort((a, b) => (b.rating?.count ?? 0) - (a.rating?.count ?? 0))[0];
    return fallback ? resolve(fallback, 0, "fallback") : null;
  }

  const winner = candidates[0];
  return resolve(winner.product, winner.score, winner.reason);
}

/* -------------------------------------------------------------------------- */
/*                                  Scoring                                    */
/* -------------------------------------------------------------------------- */

function scoreCandidate(
  candidate: Product,
  cartProducts: Product[]
): { score: number; reason: ResolvedPostPurchaseUpsell["reason"] } {
  let score = 0;
  let reason: ResolvedPostPurchaseUpsell["reason"] = "fallback";

  for (const cartProduct of cartProducts) {
    if (cartProduct.upsellIds?.includes(candidate.id)) {
      score += 50;
      reason = "curated";
    }
    if (candidate.collection && cartProduct.collection === candidate.collection) {
      score += 30;
      if (reason === "fallback") reason = "collection";
    }
    if (
      candidate.collection &&
      cartProduct.collection &&
      COMPLEMENT_MAP[cartProduct.collection]?.includes(candidate.collection)
    ) {
      score += 20;
      if (reason === "fallback" || reason === "collection") reason = "complement";
    }
  }

  // Bonus for sitting in the *ideal* anchor window.
  const ratio = candidate.price.amount / POST_PURCHASE_OFFER_PRICE.amount;
  if (ratio >= IDEAL_ANCHOR_RATIO_MIN && ratio <= IDEAL_ANCHOR_RATIO_MAX) {
    score += 10;
  }

  // Tiny rating-based tiebreaker — keeps deterministic output across runs.
  const ratingCount = candidate.rating?.count ?? 0;
  score += Math.log10(ratingCount + 1);

  return { score, reason };
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                    */
/* -------------------------------------------------------------------------- */

function isAnchorCredible(product: Product): boolean {
  if (product.price.currency !== POST_PURCHASE_OFFER_PRICE.currency) return false;
  const ratio = product.price.amount / POST_PURCHASE_OFFER_PRICE.amount;
  return ratio >= MIN_ANCHOR_RATIO && ratio <= MAX_ANCHOR_RATIO;
}

function resolve(
  product: Product,
  score: number,
  reason: ResolvedPostPurchaseUpsell["reason"]
): ResolvedPostPurchaseUpsell {
  const savings: Money = {
    amount: product.price.amount - POST_PURCHASE_OFFER_PRICE.amount,
    currency: product.price.currency,
  };
  const discountPercent = Math.round((savings.amount / product.price.amount) * 100);

  return {
    product,
    offerPrice: POST_PURCHASE_OFFER_PRICE,
    basePrice: product.price,
    savings,
    discountPercent,
    score,
    reason,
  };
}
