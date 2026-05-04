"use client";

import { useEffect } from "react";
import { useCartCrossSells } from "@/hooks/useUpsells";
import { useLocale } from "@/hooks/useLocale";
import { track } from "@/lib/analytics";
import { CrossSellCard } from "./CrossSellCard";

/**
 * Same-price cross-sell slot rendered inside the cart drawer.
 * Capped at 2 — research (Baymard) shows ≤2 in-drawer suggestions have the
 * highest attach-rate without pushing the checkout CTA below the mobile fold.
 */
export function CrossSellSlot({ max = 2 }: { max?: number }) {
  const { t } = useLocale();
  const items = useCartCrossSells(max);

  useEffect(() => {
    items.forEach((p) =>
      track("view_upsell", { item_id: p.id, surface: "cart_drawer" })
    );
  }, [items]);

  if (items.length === 0) return null;

  return (
    <section aria-label="Cross-sell" className="border-t border-line px-5 py-4">
      <header className="mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          {t.cart.youMightAlsoLike}
        </h3>
        <p className="mt-0.5 text-[11px] text-muted/80">{t.cart.crossSellHint}</p>
      </header>
      <div className="space-y-2">
        {items.map((p) => (
          <CrossSellCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
