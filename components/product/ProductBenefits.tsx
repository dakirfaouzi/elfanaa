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
    <section className="bg-surface py-16 md:py-24">
      <Container>
        <header className="mb-10 max-w-2xl md:mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            {t.product.benefitsEyebrow}
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
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
                <span className="grid size-11 place-items-center rounded-full bg-accent/10 text-accent">
                  <Icon className="size-5" strokeWidth={1.5} />
                </span>
                <h3 className="text-[15px] font-semibold tracking-tight text-ink md:text-base">
                  {pickLocalized(b.title, locale)}
                </h3>
                <p className="text-sm leading-relaxed text-muted">
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
