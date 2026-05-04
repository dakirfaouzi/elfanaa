"use client";

import { useMemo } from "react";
import { useCart } from "./useCart";
import { resolveCartCrossSells } from "@/data/upsells";
import { selectPostPurchaseUpsell } from "@/lib/upsell/strategy";

/** In-cart "pairs beautifully" suggestions (full price, ±20% band). */
export function useCartCrossSells(max = 2) {
  const cart = useCart((s) => s.cart);
  return useMemo(() => resolveCartCrossSells(cart, max), [cart, max]);
}

/** Fixed-price (99 SAR) one-click post-purchase upsell, picked against the order. */
export function usePostPurchaseUpsell(orderProductIds: string[]) {
  return useMemo(() => selectPostPurchaseUpsell(orderProductIds), [orderProductIds]);
}
