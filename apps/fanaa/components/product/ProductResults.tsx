"use client";

import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import type { Product } from "@/lib/types";

type Props = { product: Product };

/**
 * Results / expectation timeline (Step 4 §4.1).
 *
 * Sets honest, time-anchored expectations ("by week 2…") so the buyer can
 * picture the outcome and the brand pre-empts the "it didn't work overnight"
 * refund. Rendered as a left-railed vertical timeline — one column on mobile,
 * which is the dominant surface. Renders nothing without a grounded timeline.
 */
export function ProductResults({ product }: Props) {
  const { locale } = useLocale();
  const content = product.sectionContent?.results;
  if (!content || content.timeline.length === 0) return null;

  const eyebrow = locale === "ar" ? "ماذا تتوقع" : "What to expect";
  const title =
    locale === "ar" ? "رحلتك مع المنتج" : "Your journey, week by week";

  return (
    <section className="fn-section-y bg-surface">
      <Container>
        <div className="mx-auto max-w-3xl">
          <header className="mb-8 md:mb-12">
            <p className="fn-eyebrow">
              <span className="fn-rule" />
              <span>{eyebrow}</span>
            </p>
            <h2 className="fn-section-title mt-4">{title}</h2>
            {content.intro ? (
              <p className="mt-4 text-[15px] leading-[1.85] text-muted md:text-base">
                {pickLocalized(content.intro, locale)}
              </p>
            ) : null}
          </header>

          <ol className="relative flex flex-col gap-7 ps-6 md:gap-9 md:ps-8">
            <span
              className="absolute inset-y-1 start-[5px] w-px bg-line md:start-[7px]"
              aria-hidden
            />
            {content.timeline.map((milestone, i) => (
              <li key={i} className="relative">
                <span
                  className="absolute -start-6 top-1 size-2.5 rounded-full bg-accent ring-4 ring-surface md:-start-8"
                  aria-hidden
                />
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent">
                  {pickLocalized(milestone.when, locale)}
                </p>
                <p className="mt-1.5 text-[14.5px] leading-[1.75] text-ink md:text-[15px]">
                  {pickLocalized(milestone.outcome, locale)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
