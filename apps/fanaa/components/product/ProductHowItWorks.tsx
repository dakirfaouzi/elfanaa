"use client";

import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import { SectionFigure } from "@/components/product/SectionFigure";
import type { Product, ProductImage } from "@/lib/types";

type Props = { product: Product; image?: ProductImage };

/**
 * How-it-works / mechanism section — section-NATIVE creative (Phase 4.6.4a).
 *
 * The benchmark "how to use" creative is a numbered usage journey (big 1·2·3·4
 * steps beside the product). We compose that from the structured Arabic
 * `howItWorks.steps` so the educational copy stays crisp Arabic RTL. The
 * assigned mechanism/application visual anchors the section (sticky rail on
 * desktop, hero on mobile-first) while the large numbered steps explain the
 * process. Renders nothing when the pipeline didn't ground a mechanism.
 */
export function ProductHowItWorks({ product, image }: Props) {
  const { locale } = useLocale();
  const content = product.sectionContent?.howItWorks;
  if (!content || content.steps.length === 0) return null;

  const eyebrow = locale === "ar" ? "كيف يعمل" : "How it works";
  const title =
    locale === "ar" ? "الآلية وراء النتائج" : "The mechanism behind the results";

  const steps = (
    <ol className="flex flex-col gap-6 md:gap-8">
      {content.steps.map((step, i) => (
        <li key={i} className="flex items-start gap-4 md:gap-6">
          <span className="font-display text-4xl font-semibold leading-none text-accent/70 tabular-nums md:text-5xl">
            {i + 1}
          </span>
          <div className="border-s border-line ps-4 pt-1 md:ps-6">
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
  );

  return (
    <section className="fn-section-y border-t border-line bg-bg">
      <Container>
        <header className="mx-auto mb-10 max-w-3xl md:mb-14">
          <p className="fn-eyebrow">
            <span className="fn-rule" />
            <span>{eyebrow}</span>
          </p>
          <h2 className="fn-section-title mt-4">{title}</h2>
          <p className="mt-4 text-[15px] leading-[1.85] text-muted md:text-base">
            {pickLocalized(content.summary, locale)}
          </p>
        </header>

        {image ? (
          <div className="grid items-start gap-8 md:gap-12 lg:grid-cols-2">
            <SectionFigure
              image={image}
              className="lg:sticky lg:top-24"
            />
            <div>{steps}</div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">{steps}</div>
        )}
      </Container>
    </section>
  );
}
