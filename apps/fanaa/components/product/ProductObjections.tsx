"use client";

import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import type { Product } from "@/lib/types";

type Props = { product: Product };

/**
 * Objection-handling block (Step 4 §4.1).
 *
 * Distinct from the FAQ: these are the *purchase-blocking* doubts ("is it
 * safe", "will it work for me") answered with a confident reframe rather than
 * logistics. Rendered as a calm two-line card list that scans fast on mobile.
 * Renders nothing unless the pipeline grounded objection/response pairs.
 */
export function ProductObjections({ product }: Props) {
  const { locale } = useLocale();
  const content = product.sectionContent?.objections;
  if (!content || content.items.length === 0) return null;

  const eyebrow = locale === "ar" ? "نطمئنك" : "Honest answers";
  const title =
    locale === "ar" ? "ماذا لو كنت متردداً؟" : "Still on the fence?";

  return (
    <section className="fn-section-y bg-bg">
      <Container>
        <div className="mx-auto max-w-3xl">
          <header className="mb-8 md:mb-12">
            <p className="fn-eyebrow">
              <span className="fn-rule" />
              <span>{eyebrow}</span>
            </p>
            <h2 className="fn-section-title mt-4">{title}</h2>
          </header>

          <ul className="flex flex-col gap-4 md:gap-5">
            {content.items.map((item, i) => (
              <li
                key={i}
                className="rounded-2xl border border-line bg-surface p-5 md:p-6"
              >
                <p className="text-[15px] font-semibold tracking-[-0.005em] text-ink md:text-[15.5px]">
                  {pickLocalized(item.objection, locale)}
                </p>
                <p className="mt-2 text-[14px] leading-[1.75] text-muted md:text-[14.5px]">
                  {pickLocalized(item.response, locale)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
