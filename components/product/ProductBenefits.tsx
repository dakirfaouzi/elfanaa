"use client";

import * as Lucide from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import type { Product } from "@/lib/types";

type Props = { product: Product };

/**
 * Benefits — NOT features.
 *
 * Premium DTC brands (Goop, Aesop, Public Goods) lead with the *why-this-
 * matters-to-you* sentence, then the literal feature in small text. We
 * keep the same hierarchy and cap the list at four items so the section
 * reads as a complete grid on every screen.
 *
 * Each benefit's icon is referenced by lucide name. If the name doesn't
 * resolve we fall back to a neutral Sparkles glyph rather than crashing.
 */
export function ProductBenefits({ product }: Props) {
  const { locale, t } = useLocale();
  const items = product.benefits;
  if (!items || items.length === 0) return null;

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

        <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((b, i) => {
            const Icon =
              (Lucide as unknown as Record<
                string,
                React.ComponentType<{ className?: string; strokeWidth?: number }>
              >)[b.icon] ?? Lucide.Sparkles;
            return (
              <li key={i} className="flex flex-col gap-3">
                <span className="grid size-12 place-items-center rounded-full bg-accent/12 text-accent ring-1 ring-accent/20">
                  <Icon className="size-5" strokeWidth={1.5} />
                </span>
                <h3 className="text-[15.5px] font-semibold tracking-[-0.005em] text-ink md:text-base">
                  {pickLocalized(b.title, locale)}
                </h3>
                <p className="text-[14px] leading-[1.75] text-muted md:text-[14.5px]">
                  {pickLocalized(b.body, locale)}
                </p>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
