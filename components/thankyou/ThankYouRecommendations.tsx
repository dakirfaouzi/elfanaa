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
 * ThankYouRecommendations — subtle "you may also like" strip.
 *
 * Difference from the cross-sells section directly above it:
 *   • Cross-sells = price-bracketed, hand-picked complements.
 *   • Recommendations = seasonal best-sellers minus what the buyer
 *     already has or was just shown.  Acts as a soft on-ramp to the
 *     next purchase without competing with the cross-sells.
 *
 * Visual brief in this redesign:
 *   • Subtler header — eyebrow + clean h2, no marketing copy that
 *     reads as "salesy" on a confirmation page.
 *   • Grid → 2 columns on mobile, 4 on desktop.  The cards themselves
 *     stay unchanged (we deliberately don't re-skin `ProductCard`
 *     here — that's a storefront-wide component that other surfaces
 *     depend on).
 *   • If there are no recommendations (extremely rare — would require
 *     ordering every best-seller in one go), the section returns
 *     `null` and the page lands directly on the contact panel.
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
    <section
      aria-labelledby="ty-recs-title"
      className="bg-surface py-12 md:py-16"
    >
      <Container>
        <header className="mb-7 md:mb-9">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[rgb(var(--color-accent-deep))]">
            {t.thankyou.recommendationsEyebrow}
          </p>
          <h2
            id="ty-recs-title"
            className="mt-1.5 font-display text-[22px] font-semibold tracking-tight text-ink md:text-3xl"
          >
            {t.thankyou.recommendationsTitle}
          </h2>
        </header>

        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6 md:gap-y-10">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </Container>
    </section>
  );
}
