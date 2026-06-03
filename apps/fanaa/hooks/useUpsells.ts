"use client";

import { useEffect, useMemo, useState } from "react";
import { useCart } from "./useCart";
import { resolveCartCrossSells } from "@/data/upsells";
import {
  selectPostPurchaseUpsell,
  type ResolvedPostPurchaseUpsell,
} from "@/lib/upsell/strategy";
import type { Product } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/*                       Configured cross-sells (server)                      */
/* -------------------------------------------------------------------------- */

/**
 * Fetch the operator-configured cross-sells for a set of anchor products
 * (the ids/slugs currently in the cart or order) from the hybrid catalog.
 *
 * Returns `[]` on any error or empty result — the caller then falls back to the
 * legacy snapshot heuristic, so the surface never breaks.
 */
async function fetchConfiguredCrossSells(
  anchorRefs: string[],
  excludeIds: string[],
  max: number,
): Promise<Product[]> {
  if (anchorRefs.length === 0) return [];
  const params = new URLSearchParams();
  params.set("for", anchorRefs.join(","));
  if (excludeIds.length > 0) params.set("exclude", excludeIds.join(","));
  params.set("max", String(max));
  try {
    const res = await fetch(`/api/catalog/cross-sells?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { products?: Product[] };
    return Array.isArray(data.products) ? data.products : [];
  } catch {
    return [];
  }
}

/**
 * Resolve cross-sells for a set of anchor product ids: operator-configured
 * `upsellIds` first (the single source of truth), falling back to the supplied
 * legacy heuristic only when nothing is configured/resolvable.
 *
 * `fallback` is captured fresh each run — we intentionally key the effect on
 * the anchor ids + `max` (not on `fallback`'s identity) so it doesn't re-fetch
 * on unrelated re-renders.
 */
function useConfiguredCrossSells(
  anchorIds: string[],
  max: number,
  fallback: () => Product[],
): Product[] {
  const anchorKey = anchorIds.join(",");
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    let cancelled = false;
    const refs = anchorKey ? anchorKey.split(",") : [];

    async function run() {
      if (refs.length > 0) {
        const configured = await fetchConfiguredCrossSells(refs, refs, max);
        if (!cancelled && configured.length > 0) {
          setItems(configured.slice(0, max));
          return;
        }
      }
      if (!cancelled) setItems(fallback());
    }

    void run();
    return () => {
      cancelled = true;
    };
    // `fallback` deliberately excluded — see docstring.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey, max]);

  return items;
}

/* -------------------------------------------------------------------------- */
/*                                Public hooks                                */
/* -------------------------------------------------------------------------- */

/**
 * In-cart "pairs beautifully" suggestions for the cart drawer.
 *
 * Configured `upsellIds` (resolved server-side through the hybrid catalog) win;
 * the legacy snapshot price-band heuristic (`resolveCartCrossSells`) is the
 * fallback for products without curated upsells.
 */
export function useCartCrossSells(max = 2): Product[] {
  const cart = useCart((s) => s.cart);
  const anchorIds = useMemo(
    () => cart.lines.map((l) => l.productId),
    [cart],
  );
  return useConfiguredCrossSells(anchorIds, max, () =>
    resolveCartCrossSells(cart, max),
  );
}

/**
 * Same engine as the cart drawer, but seeded from an arbitrary set of anchor
 * product ids (e.g. a thank-you order's line items). The `fallback` keeps the
 * caller's existing behaviour when nothing is configured.
 */
export function useOrderCrossSells(
  anchorIds: string[],
  max: number,
  fallback: () => Product[],
): Product[] {
  return useConfiguredCrossSells(anchorIds, max, fallback);
}

/* -------------------------------------------------------------------------- */
/*                          Post-purchase 99-SAR offer                         */
/* -------------------------------------------------------------------------- */

export interface PostPurchaseUpsellState {
  /**
   * `loading` while the configured offer is being resolved server-side.
   * Consumers MUST NOT skip the funnel on a null upsell until `resolved` —
   * otherwise a transient null during the fetch would prematurely advance the
   * customer past the offer.
   */
  status: "loading" | "resolved";
  upsell: ResolvedPostPurchaseUpsell | null;
}

/**
 * Fetch the operator-configured 99-SAR offer (`postPurchaseUpsellId`) for an
 * order from the hybrid catalog. Returns `null` on any error/empty result so
 * the caller falls back to the snapshot heuristic.
 */
async function fetchConfiguredPostPurchaseUpsell(
  anchorRefs: string[],
): Promise<ResolvedPostPurchaseUpsell | null> {
  if (anchorRefs.length === 0) return null;
  const params = new URLSearchParams();
  params.set("for", anchorRefs.join(","));
  try {
    const res = await fetch(
      `/api/catalog/post-purchase-upsell?${params.toString()}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      upsell?: ResolvedPostPurchaseUpsell | null;
    };
    return data.upsell ?? null;
  } catch {
    return null;
  }
}

/**
 * Fixed-price (99 SAR) one-click post-purchase upsell.
 *
 * Resolution order:
 *   1. Operator-pinned `postPurchaseUpsellId` resolved server-side through the
 *      hybrid catalog (so AI-generated targets / slugs / paths all resolve).
 *   2. Legacy snapshot scoring heuristic (`selectPostPurchaseUpsell`) when
 *      nothing is configured/resolvable — behaviour never regresses.
 *
 * The 99-SAR price, timer, savings, credibility, and UI are unchanged; only the
 * product SOURCE differs.
 */
export function usePostPurchaseUpsell(
  orderProductIds: string[],
): PostPurchaseUpsellState {
  const anchorKey = orderProductIds.join(",");
  const [state, setState] = useState<PostPurchaseUpsellState>({
    status: "loading",
    upsell: null,
  });

  useEffect(() => {
    let cancelled = false;
    const refs = anchorKey ? anchorKey.split(",") : [];
    setState({ status: "loading", upsell: null });

    async function run() {
      const configured = await fetchConfiguredPostPurchaseUpsell(refs);
      if (cancelled) return;
      if (configured) {
        setState({ status: "resolved", upsell: configured });
        return;
      }
      // Fallback: snapshot scoring heuristic (client-safe, pure).
      setState({ status: "resolved", upsell: selectPostPurchaseUpsell(refs) });
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [anchorKey]);

  return state;
}
