"use client";

import { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Cart, CartLine, CartLineSource, Money, Product } from "@/lib/types";
import { lineTotal } from "@/lib/pricing";
import { getProductById } from "@/data/products";
import { siteConfig } from "@/data/site";
import { STORAGE_KEY_CART } from "@/lib/brand";
import { track, trackCommerce } from "@/lib/analytics";

type AddOptions = {
  variantId?: string;
  /**
   * Marks a line as a cart-drawer cross-sell (vs. a primary base
   * product). Drives the deterministic `base / upsell / cross_sell`
   * slot order written into Google Sheets. See `CartLineSource`.
   *
   * Default — when omitted — is `"base"`, which preserves the
   * behaviour of every existing call-site (PDP buy buttons,
   * sticky CTAs, `/sugarbear` flow). Only `CrossSellCard` opts
   * into `"cross_sell"`.
   */
  source?: CartLineSource;
  /**
   * Full product record to use INSTEAD of (or in addition to) a
   * snapshot lookup (M12 / Step 2 / Phase 2.5).
   *
   * # Why this matters
   *
   * AI-generated products published from Studio live in
   * `storefront_catalog_product`, NOT in the build-time
   * `data/products.ts` snapshot. The PDP, ProductCard, and
   * CrossSellCard receive these products via the hybrid loader
   * (server-side) and pass them to `add()` here. Without this
   * field the cart would silently no-op every AI-gen add (snapshot
   * `getProductById` miss → early return).
   *
   * When provided, the product is:
   *   • Used as the source of truth for the analytics
   *     `trackCommerce("add_to_cart")` payload.
   *   • Embedded into the cart line as `productSnapshot` so every
   *     selector (`useResolvedCartLines`, `useCartSubtotal`,
   *     `resolveCartCrossSells`) can render it without needing
   *     access to the hybrid loader at render time.
   *
   * Backward compatible — when omitted, falls back to the legacy
   * `getProductById` snapshot lookup. Existing snapshot callers
   * don't need to pass it; AI-gen callers must.
   */
  product?: Product;
};

type CartState = {
  cart: Cart;

  /**
   * Add a product to the cart.
   *
   * Backwards-compatible signature:
   *   - `add(productId)`
   *   - `add(productId, quantity)`
   *   - `add(productId, quantity, variantId)`     (legacy)
   *   - `add(productId, quantity, { source, variantId })`  (new)
   *
   * A string third argument is treated as `variantId` for parity
   * with every pre-existing call site.
   */
  add: (
    productId: string,
    quantity?: number,
    variantIdOrOptions?: string | AddOptions
  ) => void;
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

      add: (productId, quantity = 1, variantIdOrOptions) => {
        // Backwards-compatible argument handling — accept either a
        // bare `variantId` string (legacy callers) or an options
        // object with `{ variantId, source, product }`. The string
        // branch is the pre-Phase-2.5 surface that every existing
        // call-site relied on.
        const opts: AddOptions =
          typeof variantIdOrOptions === "string"
            ? { variantId: variantIdOrOptions }
            : variantIdOrOptions ?? {};
        const variantId = opts.variantId;
        const source: CartLineSource = opts.source ?? "base";

        /*
         * Resolve the product. Phase 2.5 ("bridge the catalog split"):
         *   1. Prefer `opts.product` — set by PDP / ProductCard /
         *      CrossSellCard, which have the full Product in scope.
         *      This is the ONLY path that works for AI-generated
         *      products (they don't exist in the snapshot).
         *   2. Fall back to `getProductById(productId)` for legacy
         *      callers that haven't been updated to pass `product`
         *      yet. Snapshot products still resolve here exactly as
         *      they did before — zero behavioural change.
         *
         * If BOTH fail we early-return (preserves the existing
         * "silent reject unknown id" contract — but now only fires
         * on TRUE catalog drift, not on the entire AI-gen surface).
         */
        const product = opts.product ?? getProductById(productId);
        if (!product) return;

        set((state) => {
          const lines = [...state.cart.lines];
          const idx = lines.findIndex(
            (l) => lineKey(l.productId, l.variantId) === lineKey(productId, variantId)
          );
          if (idx >= 0) {
            // Merging same productId+variant: keep the prior source
            // when re-adding a base item, but upgrade to "cross_sell"
            // if a cross-sell add lands on a previously empty line.
            // Once a line is "cross_sell" it stays "cross_sell" — the
            // intent at first add is the most accurate signal.
            //
            // `productSnapshot` is refreshed on every re-add so a
            // mid-session price/copy edit (operator publishes an
            // update via Studio) propagates to the cart line on the
            // next add, even if the user already had the product
            // there. This is the same freshness contract the hybrid
            // loader gives display pages.
            const prev = lines[idx];
            const mergedSource: CartLineSource =
              prev.source === "cross_sell" || source === "cross_sell"
                ? "cross_sell"
                : "base";
            lines[idx] = {
              ...prev,
              quantity: prev.quantity + quantity,
              source: mergedSource,
              productSnapshot: product,
            };
          } else {
            lines.push({
              productId,
              variantId,
              quantity,
              source,
              productSnapshot: product,
            });
          }
          return { cart: { ...state.cart, lines } };
        });

        trackCommerce("add_to_cart", {
          product,
          quantity,
          value: lineTotal(product, quantity),
          extra: { variant_id: variantId, source },
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
          // Phase 2.5: prefer the embedded `productSnapshot` so AI-
          // generated products (absent from `getProductById`) still
          // contribute to the subtotal. Falls back to snapshot lookup
          // for legacy persisted carts that pre-date the embed.
          const product = l.productSnapshot ?? getProductById(l.productId);
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
      // Phase 2.5: embedded `productSnapshot` wins — it's the only
      // source for AI-generated products and matches the snapshot
      // exactly for curated ones. Snapshot lookup remains as the
      // tail fallback for legacy persisted carts.
      const product = line.productSnapshot ?? getProductById(line.productId);
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
      // Phase 2.5: see `selectResolvedLines` for rationale — embedded
      // snapshot wins, snapshot lookup is the legacy-cart fallback.
      const product = l.productSnapshot ?? getProductById(l.productId);
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
          // Phase 2.5: same snapshot-first → embedded contract as
          // `selectResolvedLines`. Hooks and selectors stay in lock-
          // step so cart-drawer (uses hook) and order POST mirror
          // (uses selector) never diverge on what's renderable.
          const product = line.productSnapshot ?? getProductById(line.productId);
          return product ? { ...line, product } : null;
        })
        .filter((l): l is ResolvedLine => Boolean(l)),
    [lines]
  );
}
