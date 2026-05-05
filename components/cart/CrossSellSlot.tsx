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
  const { t, locale } = useLocale();
  const items = useCartCrossSells(max);

  useEffect(() => {
    items.forEach((p) =>
      track("view_upsell", { item_id: p.id, surface: "cart_drawer" })
    );
  }, [items]);

  if (items.length === 0) return null;

  return (
    <section aria-label="Cross-sell" className="border-t border-line bg-brand-soft/60 px-5 py-4">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-ink">
            {t.cart.youMightAlsoLike}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted">{t.cart.crossSellHint}</p>
        </div>
        <span className="shrink-0 rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
          {locale === "ar" ? "وفّر أكثر" : "Save more"}
        </span>
      </header>
      <div className="space-y-2">
        {items.map((p) => (
          <CrossSellCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
