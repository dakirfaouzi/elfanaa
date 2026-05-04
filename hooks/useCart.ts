"use client";

import { useEffect, useMemo, useState } from "react";
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

// ─────────────────────────────────────────────────────────────────────────────
// Stable derived hooks
// ─────────────────────────────────────────────────────────────────────────────
//
// Reading derived state straight off the store with selectors that build a
// fresh object on every call — e.g. `useCart((s) => s.subtotal())` — produces
// a new reference each render. Zustand's default `Object.is` comparator then
// schedules a re-render, the selector runs again, the cycle repeats, and
// React eventually throws #185 ("Maximum update depth exceeded").
//
// The hooks below are the single source of truth for derived cart values.
// They subscribe to the *primitive* underlying slice (`cart.lines`) — which
// only changes when the cart actually mutates — and use `useMemo` to derive
// the object/array shape consumers need with stable referential identity.

/** Total quantity across all cart lines (primitive — already stable). */
export function useCartItemCount(): number {
  return useCart((s) => s.cart.lines.reduce((acc, l) => acc + l.quantity, 0));
}

/** Memoised cart subtotal as `Money`. New reference only when lines change. */
export function useCartSubtotal(): Money {
  const lines = useCart((s) => s.cart.lines);
  const currency = useCart((s) => s.cart.currency);
  return useMemo<Money>(() => {
    const amount = lines.reduce((acc, l) => {
      const product = getProductById(l.productId);
      if (!product) return acc;
      return acc + lineTotal(product, l.quantity).amount;
    }, 0);
    return { amount, currency };
  }, [lines, currency]);
}

/** Memoised free-shipping progress { current, threshold, ratio }. */
export function useFreeShippingProgress(): {
  current: number;
  threshold: number;
  ratio: number;
} {
  const subtotal = useCartSubtotal();
  return useMemo(() => {
    const threshold = siteConfig.freeShippingThreshold;
    const current = subtotal.amount;
    return { current, threshold, ratio: Math.min(1, current / threshold) };
  }, [subtotal.amount]);
}

/** Memoised resolved cart lines with `product` joined in. */
export function useResolvedCartLines(): ResolvedLine[] {
  const lines = useCart((s) => s.cart.lines);
  return useMemo(
    () =>
      lines
        .map((line) => {
          const product = getProductById(line.productId);
          return product ? { ...line, product } : null;
        })
        .filter((l): l is ResolvedLine => Boolean(l)),
    [lines]
  );
}
