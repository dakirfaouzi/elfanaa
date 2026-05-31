"use client";

import { Check, X } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import type { Product } from "@/lib/types";

type Props = { product: Product };

/**
 * Us-vs-the-usual-way comparison (Step 4 §4.1).
 *
 * Sharpens the "why not just buy the cheap alternative" objection into a
 * side-by-side that frames the product as the obvious upgrade. Two stacked
 * cards on mobile (ours first — it's the one we want read), side-by-side from
 * `sm`. Renders nothing unless the pipeline grounded both columns.
 */
export function ProductComparison({ product }: Props) {
  const { locale } = useLocale();
  const content = product.sectionContent?.comparison;
  if (!content || content.ours.length === 0 || content.usual.length === 0) {
    return null;
  }

  const eyebrow = locale === "ar" ? "المقارنة" : "The difference";
  const title =
    locale === "ar" ? "لماذا هذا المنتج مختلف" : "Why this is different";
  const oursLabel = locale === "ar" ? "معنا" : "With us";
  const usualLabel = locale === "ar" ? "الطريقة المعتادة" : "The usual way";

  return (
    <section className="fn-section-y border-t border-line bg-surface">
      <Container>
        <div className="mx-auto max-w-3xl">
          <header className="mb-8 text-center md:mb-12">
            <p className="fn-eyebrow justify-center">
              <span className="fn-rule" />
              <span>{eyebrow}</span>
              <span className="fn-rule" />
            </p>
            <h2 className="fn-section-title mt-4">{title}</h2>
            {content.intro ? (
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.85] text-muted md:text-base">
                {pickLocalized(content.intro, locale)}
              </p>
            ) : null}
          </header>

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
            <div className="rounded-2xl border border-accent/30 bg-accent/[0.06] p-6 shadow-[0_8px_28px_rgba(199,162,124,0.14)]">
              <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-accent">
                {oursLabel}
              </p>
              <ul className="flex flex-col gap-3">
                {content.ours.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-accent"
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    <span className="text-[14px] leading-[1.7] text-ink md:text-[14.5px]">
                      {pickLocalized(item, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-line bg-bg p-6">
              <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">
                {usualLabel}
              </p>
              <ul className="flex flex-col gap-3">
                {content.usual.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <X
                      className="mt-0.5 size-4 shrink-0 text-muted/70"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span className="text-[14px] leading-[1.7] text-muted md:text-[14.5px]">
                      {pickLocalized(item, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
