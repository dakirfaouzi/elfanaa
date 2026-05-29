import type { Cart, Product } from "@/lib/types";
import { effectiveUnitPrice } from "@/lib/pricing";
import { getProductById, products } from "./products";

/* -------------------------------------------------------------------------- */
/*                              Cross-sell strategy                            */
/* -------------------------------------------------------------------------- */

/**
 * In-cart cross-sells (the *drawer* surface).
 *
 * Different from the post-purchase upsell:
 *   • Cross-sells run inside the cart drawer, BEFORE checkout.
 *   • They keep their full price (no discount).
 *   • Goal: lift basket size with on-brand pairings.
 *
 * The post-purchase 99 SAR offer is a separate concern and lives in
 * `lib/upsell/strategy.ts`.
 *
 * Selection: same-price-bracket (±20% of the most expensive line in the cart).
 * Priorities: editorial `upsellIds` → price-band match → same-collection fallback.
 */
const PRICE_BAND_TOLERANCE = 0.2;

export function resolveCartCrossSells(cart: Cart, max = 2): Product[] {
  const inCartIds = new Set(cart.lines.map((l) => l.productId));
  /*
   * Phase 2.5 ("bridge the catalog split"): seed the strategy from
   * each cart line's embedded `productSnapshot` first, then fall
   * back to the snapshot lookup for legacy cart lines that pre-date
   * the embed. Without this, AI-generated products in the cart
   * would contribute NOTHING to the candidate scoring (snapshot
   * miss → filtered out), so the drawer would just show snapshot-
   * based fallbacks unrelated to what's actually in the basket.
   *
   * The candidate POOL stays snapshot-only on purpose — AI-gen
   * products don't yet have curated `upsellIds`, badges, or
   * collection assignments, and surfacing them as cross-sells
   * would push customers into the same cold-start state we're
   * trying to bridge. Operators can promote AI-gen products into
   * `bestSellerIds` / collections once they're ready.
   */
  const cartProducts = cart.lines
    .map((l) => l.productSnapshot ?? getProductById(l.productId))
    .filter((p): p is Product => Boolean(p));

  if (cartProducts.length === 0) return [];

  const curated = dedupeById(
    cartProducts.flatMap((p) => (p.upsellIds ?? []).map(getProductById))
  ).filter((p): p is Product => Boolean(p) && !inCartIds.has(p.id));

  const cartUnitPrices = cart.lines.map((l) => {
    const p = l.productSnapshot ?? getProductById(l.productId);
    return p ? effectiveUnitPrice(p, l.quantity).amount : 0;
  });
  const target = Math.max(...cartUnitPrices);

  const samePrice = products
    .filter((p) => !inCartIds.has(p.id))
    .filter((p) => withinBand(p.price.amount, target, PRICE_BAND_TOLERANCE));

  const collectionFallback = cartProducts.flatMap((p) =>
    products.filter(
      (x) => x.collection === p.collection && x.id !== p.id && !inCartIds.has(x.id)
    )
  );

  const merged = dedupeById([...curated, ...samePrice, ...collectionFallback]);
  return merged.slice(0, max);
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                    */
/* -------------------------------------------------------------------------- */

function withinBand(value: number, target: number, tolerance: number): boolean {
  if (target <= 0) return false;
  const ratio = Math.abs(value - target) / target;
  return ratio <= tolerance;
}

function dedupeById<T extends { id: string }>(items: (T | undefined)[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    if (!it || seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}
