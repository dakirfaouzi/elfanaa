"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Cart, CartLine, Money } from "@/lib/types";
import { lineTotal } from "@/lib/pricing";
import { getProductById } from "@/data/products";
import { siteConfig } from "@/data/site";
import { STORAGE_KEY_CART } from "@/lib/brand";
import { track, trackCommerce } from "@/lib/analytics";

type CartState = {
  cart: Cart;

  add: (productId: string, quantity?: number, variantId?: string) => void;
  remove: (productId: string, variantId?: string) => void;
  setQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clear: () => void;

  /** Derived selectors — exposed as plain getters for component use. */
  itemCount: () => number;
  subtotal: () => Money;
  freeShippingProgress: () => { current: number; threshold: number; ratio: number };
};

const emptyCart: Cart = { lines: [], currency: siteConfig.currency };

const lineKey = (productId: string, variantId?: string) =>
  `${productId}::${variantId ?? "_"}`;

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      cart: emptyCart,

      add: (productId, quantity = 1, variantId) => {
        const product = getProductById(productId);
        if (!product) return;

        set((state) => {
          const lines = [...state.cart.lines];
          const idx = lines.findIndex(
            (l) => lineKey(l.productId, l.variantId) === lineKey(productId, variantId)
          );
          if (idx >= 0) {
            lines[idx] = { ...lines[idx], quantity: lines[idx].quantity + quantity };
          } else {
            lines.push({ productId, variantId, quantity });
          }
          return { cart: { ...state.cart, lines } };
        });

        trackCommerce("add_to_cart", {
          product,
          quantity,
          value: lineTotal(product, quantity),
          extra: { variant_id: variantId },
        });
      },

      remove: (productId, variantId) => {
        set((state) => ({
          cart: {
            ...state.cart,
            lines: state.cart.lines.filter(
              (l) => lineKey(l.productId, l.variantId) !== lineKey(productId, variantId)
            ),
          },
        }));
        track("remove_from_cart", { item_id: productId, variant_id: variantId });
      },

      setQuantity: (productId, quantity, variantId) => {
        if (quantity <= 0) {
          get().remove(productId, variantId);
          return;
        }
        set((state) => ({
          cart: {
            ...state.cart,
            lines: state.cart.lines.map((l) =>
              lineKey(l.productId, l.variantId) === lineKey(productId, variantId)
                ? { ...l, quantity }
                : l
            ),
          },
        }));
      },

      clear: () => set({ cart: emptyCart }),

      itemCount: () => get().cart.lines.reduce((acc, l) => acc + l.quantity, 0),

      subtotal: () => {
        const total = get().cart.lines.reduce((acc, l) => {
          const product = getProductById(l.productId);
          if (!product) return acc;
          return acc + lineTotal(product, l.quantity).amount;
        }, 0);
        return { amount: total, currency: get().cart.currency };
      },

      freeShippingProgress: () => {
        const current = get().subtotal().amount;
        const threshold = siteConfig.freeShippingThreshold;
        return { current, threshold, ratio: Math.min(1, current / threshold) };
      },
    }),
    {
      name: STORAGE_KEY_CART,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage)
      ),
      partialize: (state) => ({ cart: state.cart }),
      // Rehydration completion is observed via `useCartHydrated` below — the
      // persist middleware exposes the `onFinishHydration` event for this.
    }
  )
);

/**
 * Subscribes to persist-middleware hydration. Returns `true` once the store
 * has reconciled with localStorage so consumers can guard SSR/CSR badge
 * flicker without forcing a hard `'use client'` on the entire tree.
 *
 * IMPORTANT — initial value MUST be `false`, not `useCart.persist.hasHydrated()`.
 * Zustand's persist middleware is synchronous in the browser, so by the time
 * React renders for the first time on the client, `hasHydrated()` may already
 * be `true`. On the server it is always `false`. Branching off that during the
 * initial render produces a server/client divergence and React throws #418
 * the moment the cart actually contains items. Flipping the flag exclusively
 * inside `useEffect` makes the first paint identical on both runtimes; the
 * post-mount re-render then reveals the cart badge.
 */
export function useCartHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useCart.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsubFinish = useCart.persist.onFinishHydration(() => setHydrated(true));
    return () => unsubFinish();
  }, []);

  return hydrated;
}

/** Lines joined with their product records — handy for rendering. */
export type ResolvedLine = CartLine & { product: NonNullable<ReturnType<typeof getProductById>> };

export function selectResolvedLines(state: CartState): ResolvedLine[] {
  return state.cart.lines
    .map((line) => {
      const product = getProductById(line.productId);
      return product ? { ...line, product } : null;
    })
    .filter((l): l is ResolvedLine => Boolean(l));
}
