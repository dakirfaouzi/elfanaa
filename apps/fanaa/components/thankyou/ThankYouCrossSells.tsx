"use client";

import { useMemo } from "react";
import { Container } from "@/components/layout/Container";
import { ProductCard } from "@/components/product/ProductCard";
import { useLocale } from "@/hooks/useLocale";
import { useOrderCrossSells } from "@/hooks/useUpsells";
import { resolveCartCrossSells } from "@/data/upsells";
import type { Cart } from "@/lib/types";
import type { OrderReceipt } from "@/lib/order-receipt";

type Props = {
  receipt: OrderReceipt;
};

/**
 * Same-price-bracket cross-sells on the thank-you page.
 *
 * Reuses the same `resolveCartCrossSells` engine from the cart drawer — one
 * algorithm, two surfaces. The receipt is "synthesised" into a Cart shape
 * because the strategy was designed to consume cart-style input. This keeps
 * the recommendation logic genuinely shared instead of forked.
 *
 * Capped at 3 (one row on tablet, full row on desktop) to feel curated, not
 * salesy. Hidden completely if there are no candidates — better than showing
 * an empty grid.
 */
export function ThankYouCrossSells({ receipt }: Props) {
  const { t } = useLocale();

  const synthesisedCart = useMemo<Cart>(
    () => ({
      lines: receipt.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      currency: receipt.totals.total.currency,
    }),
    [receipt]
  );
  const anchorIds = useMemo(
    () => receipt.lines.map((l) => l.productId),
    [receipt]
  );
  // Configured `upsellIds` win (resolved server-side via the hybrid catalog);
  // the legacy synthesised-cart heuristic is the fallback.
  const products = useOrderCrossSells(anchorIds, 3, () =>
    resolveCartCrossSells(synthesisedCart, 3)
  );

  if (products.length === 0) return null;

  return (
    <section className="bg-bg py-14 md:py-20">
      <Container>
        <header className="mb-10 max-w-2xl space-y-2 md:mb-12">
          <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
            {t.thankyou.crossSellTitle}
          </h2>
          <p className="text-sm text-muted md:text-base">
            {t.thankyou.crossSellSubtitle}
          </p>
        </header>

        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </Container>
    </section>
  );
}
