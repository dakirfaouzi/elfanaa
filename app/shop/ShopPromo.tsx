"use client";

import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

/**
 * Promo strip — surfaces the headline tier offer ("3 for 349") at the
 * top of the catalog so the customer sees the deal before the grid.
 *
 * Inline (not a popup) — popups on listing pages cost mobile sessions
 * (Baymard #221). The strip is dismissable via scroll alone.
 */
export function ShopPromo() {
  const { t } = useLocale();
  return (
    <section className="border-b border-line bg-ink text-bg">
      <Container>
          <div className="grid items-center gap-4 py-5 md:grid-cols-[1fr_auto] md:py-6">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              {t.shop.promoEyebrow}
            </p>
            <h2 className="font-display text-[20px] font-semibold leading-tight tracking-tight md:text-3xl">
              {t.shop.promoTitle}
            </h2>
            <p className="max-w-prose text-[13px] leading-relaxed text-bg/75 md:text-[15px]">
              {t.shop.promoBody}
            </p>
          </div>
          <div className="flex items-center gap-2 md:justify-end">
            <span
              aria-hidden
              className="text-bg/40 transition-colors group-hover:text-bg/70"
            >
              <ArrowLeft className="size-4 ltr:rotate-180" />
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}
