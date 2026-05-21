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
  const cartProducts = cart.lines
    .map((l) => getProductById(l.productId))
    .filter((p): p is Product => Boolean(p));

  if (cartProducts.length === 0) return [];

  const curated = dedupeById(
    cartProducts.flatMap((p) => (p.upsellIds ?? []).map(getProductById))
  ).filter((p): p is Product => Boolean(p) && !inCartIds.has(p.id));

  const cartUnitPrices = cart.lines.map((l) => {
    const p = getProductById(l.productId);
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
