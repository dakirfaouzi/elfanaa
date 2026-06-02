"use client";

import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import { SectionFigure } from "@/components/product/SectionFigure";
import type { Product, ProductImage } from "@/lib/types";

type Props = { product: Product; image?: ProductImage };

/**
 * Results / expectation timeline — section-NATIVE creative (Phase 4.6.4a).
 *
 * The benchmark "results" creative visualises the OUTCOME. We deliberately do
 * NOT fabricate a literal medical before/after (unreliable to generate + a GCC
 * COD claims risk). Instead we art-direct an OUTCOME panel: the assigned result
 * scene framed as the achievable end-state with an Arabic "result" caption chip,
 * beside an honest time-anchored progression timeline composed from the
 * structured `results.timeline`. Renders nothing without a grounded timeline.
 */
export function ProductResults({ product, image }: Props) {
  const { locale } = useLocale();
  const content = product.sectionContent?.results;
  if (!content || content.timeline.length === 0) return null;

  const eyebrow = locale === "ar" ? "ماذا تتوقع" : "What to expect";
  const title =
    locale === "ar" ? "رحلتك مع المنتج" : "Your journey, week by week";
  const resultChip = locale === "ar" ? "النتيجة المتوقعة" : "The result";

  const timeline = (
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
  );

  return (
    <section className="fn-section-y bg-surface">
      <Container>
        <header className="mx-auto mb-10 max-w-3xl md:mb-14">
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

        {image ? (
          <div className="grid items-start gap-8 md:gap-12 lg:grid-cols-2">
            <div className="relative">
              <SectionFigure image={image} aspectClassName="aspect-[4/5]" />
              <span className="absolute bottom-4 start-4 rounded-full bg-ink/85 px-4 py-1.5 text-[12px] font-semibold tracking-[0.04em] text-bg backdrop-blur">
                {resultChip}
              </span>
            </div>
            <div>{timeline}</div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">{timeline}</div>
        )}
      </Container>
    </section>
  );
}
