"use client";

import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import type { Product } from "@/lib/types";

type Props = { product: Product };

/**
 * How-it-works / mechanism section (Step 4 §4.1).
 *
 * Direct-response pages convert on *mechanism belief* — the buyer needs a
 * plausible "why this works" story before price stops mattering. We render a
 * short summary then a vertically-numbered step list that reads as a single
 * mobile column (the primary surface) and relaxes into more breathing room on
 * desktop. Renders nothing when the pipeline didn't ground a mechanism.
 */
export function ProductHowItWorks({ product }: Props) {
  const { locale } = useLocale();
  const content = product.sectionContent?.howItWorks;
  if (!content || content.steps.length === 0) return null;

  const eyebrow = locale === "ar" ? "كيف يعمل" : "How it works";
  const title =
    locale === "ar" ? "الآلية وراء النتائج" : "The mechanism behind the results";

  return (
    <section className="fn-section-y border-t border-line bg-bg">
      <Container>
        <div className="mx-auto max-w-3xl">
          <header className="mb-8 md:mb-12">
            <p className="fn-eyebrow">
              <span className="fn-rule" />
              <span>{eyebrow}</span>
            </p>
            <h2 className="fn-section-title mt-4">{title}</h2>
            <p className="mt-4 text-[15px] leading-[1.85] text-muted md:text-base">
              {pickLocalized(content.summary, locale)}
            </p>
          </header>

          <ol className="flex flex-col gap-5 md:gap-7">
            {content.steps.map((step, i) => (
              <li key={i} className="flex gap-4 md:gap-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/12 text-[15px] font-semibold text-accent ring-1 ring-accent/20 md:size-10">
                  {i + 1}
                </span>
                <div className="pt-1">
                  <h3 className="text-[15.5px] font-semibold tracking-[-0.005em] text-ink md:text-base">
                    {pickLocalized(step.title, locale)}
                  </h3>
                  <p className="mt-1.5 text-[14px] leading-[1.75] text-muted md:text-[14.5px]">
                    {pickLocalized(step.body, locale)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
