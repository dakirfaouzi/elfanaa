"use client";

import { useCallback } from "react";
import { useCart } from "@/hooks/useCart";
import { useUI } from "@/hooks/useUI";
import { useSugarbear } from "./state";

/**
 * The canonical product ID for the Sugarbear Hair Vitamins SKU.
 * Lives here so every CTA on the /sugarbear page can import it from
 * a single location instead of scattering the magic string.
 */
export const SUGARBEAR_PRODUCT_ID = "p_004";

/**
 * Bridge between the Sugarbear page's local bundle-selection state and
 * the global Zustand cart + UI stores.
 *
 * Returns a stable `addToCart(pieces?)` callback that:
 *   1. Replaces any existing Sugarbear line in the cart so the quantity
 *      always equals exactly the chosen bundle (never accumulates on
 *      repeated taps).
 *   2. Adds p_004 with the correct piece-count → the tier-pricing engine
 *      in lib/pricing.ts resolves 1 → 199 SAR / 2 → 279 SAR / 3 → 349 SAR.
 *   3. Opens the cart drawer with a smooth slide-in animation.
 *
 * The optional `pieces` override lets BundleCard call this synchronously
 * with its own bundle's piece-count even before the React state from
 * `onSelect()` has propagated — avoiding a stale-closure race on rapid
 * bundle-switch + add-to-cart.
 */
export function useAddToCart() {
  const { current } = useSugarbear();
  const openCart = useUI((s) => s.openCart);

  return useCallback(
    (pieces?: number) => {
      const qty = pieces ?? current.pieces;

      // Imperative read — avoids capturing `cart.lines` as a dependency
      // which would re-create the callback every time the cart changes.
      const { cart, remove, add } = useCart.getState();
      if (cart.lines.some((l) => l.productId === SUGARBEAR_PRODUCT_ID)) {
        remove(SUGARBEAR_PRODUCT_ID);
      }
      add(SUGARBEAR_PRODUCT_ID, qty);
      openCart();
    },
    [current.pieces, openCart],
  );
}
