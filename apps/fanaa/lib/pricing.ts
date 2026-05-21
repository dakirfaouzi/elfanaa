import type { Money, Product } from "./types";
import { multiplyMoney } from "./format";

/**
 * Pricing engine.
 *
 * Some products carry a *tiered offer* (e.g. 1 = 199 SAR, 2 = 279 SAR, 3 = 349 SAR)
 * — the canonical "buy more, save more" pattern used in MENA COD funnels.
 *
 * The engine has one entry point: `lineTotal(product, qty)`. Components must
 * NEVER recompute price = unitPrice × qty themselves; that breaks bundle
 * products silently. All cart math flows through this module.
 *
 * Strategy when qty exceeds the highest configured tier:
 *   • Use the highest tier as a "block" (e.g. tier-of-3 = 349 SAR)
 *   • Charge per-unit at the highest-tier rate for the remainder.
 * This is the same logic Shopify's "volume bundle" and most COD platforms use,
 * and it never punishes a customer for adding one more item.
 */

export type OfferTier = {
  /** Quantity this tier applies to. Must be > 0 and unique per product. */
  quantity: number;
  /** Total price (line, not unit) for this exact quantity. */
  total: Money;
};

export function hasOfferTiers(product: Product): boolean {
  return Array.isArray(product.offerTiers) && product.offerTiers.length > 0;
}

/**
 * Returns the line total for `product × qty`, honouring offerTiers if present.
 * Pure function — safe to call from selectors, server actions, and route handlers.
 */
export function lineTotal(product: Product, quantity: number): Money {
  if (quantity <= 0) {
    return { amount: 0, currency: product.price.currency };
  }

  if (!hasOfferTiers(product)) {
    return multiplyMoney(product.price, quantity);
  }

  const tiers = [...(product.offerTiers ?? [])].sort((a, b) => a.quantity - b.quantity);

  // Exact tier match wins.
  const exact = tiers.find((t) => t.quantity === quantity);
  if (exact) return exact.total;

  // Below the smallest tier — fall back to the unit price (rare; tiers usually start at 1).
  const smallest = tiers[0];
  if (quantity < smallest.quantity) {
    return multiplyMoney(product.price, quantity);
  }

  // Above the largest tier — use the largest tier as a "block" and add per-unit
  // remainder priced at the largest tier's per-unit rate.
  const largest = tiers[tiers.length - 1];
  const blocks = Math.floor(quantity / largest.quantity);
  const remainder = quantity % largest.quantity;
  const perUnitAtTopTier = Math.round(largest.total.amount / largest.quantity);

  return {
    amount: blocks * largest.total.amount + remainder * perUnitAtTopTier,
    currency: largest.total.currency,
  };
}

/**
 * Effective unit price after the tiered discount kicks in.
 * Useful for "you save X per piece" badges in the cart.
 */
export function effectiveUnitPrice(product: Product, quantity: number): Money {
  if (quantity <= 0) return product.price;
  const total = lineTotal(product, quantity);
  return { amount: Math.round(total.amount / quantity), currency: total.currency };
}

/**
 * Savings vs. the un-tiered baseline (qty × base unit price).
 * Returns null when the product has no tiers or there are no savings yet.
 */
export function tierSavings(product: Product, quantity: number): Money | null {
  if (!hasOfferTiers(product) || quantity <= 0) return null;
  const baseline = multiplyMoney(product.price, quantity);
  const actual = lineTotal(product, quantity);
  const diff = baseline.amount - actual.amount;
  if (diff <= 0) return null;
  return { amount: diff, currency: actual.currency };
}

/**
 * Next tier the customer could unlock by adding more units.
 * Powers "add 1 more, save 119 SAR" nudges in the drawer.
 */
export function nextTier(product: Product, quantity: number): OfferTier | null {
  if (!hasOfferTiers(product)) return null;
  const tiers = [...(product.offerTiers ?? [])].sort((a, b) => a.quantity - b.quantity);
  return tiers.find((t) => t.quantity > quantity) ?? null;
}
