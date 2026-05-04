"use client";

import { useMemo } from "react";
import { Container } from "@/components/layout/Container";
import { ProductCard } from "@/components/product/ProductCard";
import { useLocale } from "@/hooks/useLocale";
import { getBestSellers } from "@/data/products";
import type { OrderReceipt } from "@/lib/order-receipt";

type Props = {
  receipt: OrderReceipt | null;
  /** Hide products from this set (typically: items already in the order + cross-sells). */
  excludeIds?: string[];
};

/**
 * "Most-loved this season" — broader recommendations.
 *
 * Different from cross-sells: this is *seasonal merchandising*, not strict
 * relevance. Shows the curated best-sellers minus anything the customer
 * already bought OR was just shown above. Acts as a soft on-ramp to the
 * next purchase without competing with the cross-sells immediately above.
 */
export function ThankYouRecommendations({ receipt, excludeIds = [] }: Props) {
  const { t } = useLocale();

  const products = useMemo(() => {
    const exclude = new Set(excludeIds);
    if (receipt) receipt.lines.forEach((l) => exclude.add(l.productId));
    return getBestSellers().filter((p) => !exclude.has(p.id));
  }, [receipt, excludeIds]);

  if (products.length === 0) return null;

  return (
    <section className="border-t border-line bg-surface py-14 md:py-20">
      <Container>
        <header className="mb-10 max-w-2xl space-y-2 md:mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            {t.home.bestSellersEyebrow}
          </p>
          <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
            {t.thankyou.recommendationsTitle}
          </h2>
          <p className="text-sm text-muted md:text-base">
            {t.thankyou.recommendationsSubtitle}
          </p>
        </header>

        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </Container>
    </section>
  );
}
