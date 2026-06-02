"use client";

import * as Lucide from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import { SectionFigure } from "@/components/product/SectionFigure";
import type { Product, ProductImage } from "@/lib/types";

type Props = { product: Product; image?: ProductImage };

/**
 * Benefits — section-NATIVE creative (Phase 4.6.4a).
 *
 * Premium DTC brands lead with the *why-this-matters-to-you* line, then the
 * literal feature in small text. The benchmark benefits creative pairs a
 * problem/solution visual with iconified benefit call-outs. When a visual is
 * assigned we render a two-column creative (featured benefit visual + benefit
 * medallions); without one we keep the clean 4-up grid. Copy stays Arabic RTL.
 *
 * Each benefit's icon is referenced by lucide name. If the name doesn't resolve
 * we fall back to a neutral Sparkles glyph rather than crashing.
 */
export function ProductBenefits({ product, image }: Props) {
  const { locale, t } = useLocale();
  const items = product.benefits;
  if (!items || items.length === 0) return null;

  function benefitIcon(name: string) {
    return (
      (Lucide as unknown as Record<
        string,
        React.ComponentType<{ className?: string; strokeWidth?: number }>
      >)[name] ?? Lucide.Sparkles
    );
  }

  const benefitList = (
    <ul
      className={
        image
          ? "flex flex-col gap-6"
          : "grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4"
      }
    >
      {items.map((b, i) => {
        const Icon = benefitIcon(b.icon);
        return (
          <li key={i} className={image ? "flex items-start gap-4" : "flex flex-col gap-3"}>
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent/12 text-accent ring-1 ring-accent/20">
              <Icon className="size-5" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[15.5px] font-semibold tracking-[-0.005em] text-ink md:text-base">
                {pickLocalized(b.title, locale)}
              </h3>
              <p className="mt-1.5 text-[14px] leading-[1.75] text-muted md:text-[14.5px]">
                {pickLocalized(b.body, locale)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className="fn-section-y bg-surface">
      <Container>
        <header className="mb-10 max-w-2xl md:mb-14">
          <p className="fn-eyebrow">
            <span className="fn-rule" />
            <span>{t.product.benefitsEyebrow}</span>
          </p>
          <h2 className="fn-section-title mt-4 md:mt-5">
            {t.product.benefitsTitle}
          </h2>
        </header>

        {image ? (
          <div className="grid items-center gap-8 md:gap-12 lg:grid-cols-2">
            <SectionFigure image={image} />
            <div>{benefitList}</div>
          </div>
        ) : (
          benefitList
        )}
      </Container>
    </section>
  );
}
