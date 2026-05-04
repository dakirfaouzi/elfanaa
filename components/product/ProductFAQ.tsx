"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Product } from "@/lib/types";

type Props = { product: Product };

/**
 * PDP FAQ accordion — handles the top objections in line with the
 * page so the customer doesn't have to hop to a help center to convert.
 *
 * UX rules followed:
 *   • Single-open accordion (radio behaviour) — keeps the page rhythm.
 *   • The first question opens by default — surfaces an answer without
 *     a click and signals to the customer "we expect questions, here's
 *     where they live".
 *   • Touch targets are full-width, 56px tall; the Plus/Minus toggle
 *     is decorative — the whole row is the click target.
 */
export function ProductFAQ({ product }: Props) {
  const { locale, t } = useLocale();
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const items = product.faq;
  if (!items || items.length === 0) return null;

  return (
    <section className="bg-surface py-16 md:py-24">
      <Container>
        <div className="mx-auto max-w-3xl">
          <header className="mb-10 text-center md:mb-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              {t.product.faqEyebrow}
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              {t.product.faqTitle}
            </h2>
          </header>

          <ul className="divide-y divide-line border-y border-line">
            {items.map((item, idx) => {
              const open = openIdx === idx;
              return (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => setOpenIdx(open ? null : idx)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-4 py-5 text-start"
                  >
                    <span className="text-[15px] font-medium text-ink md:text-base">
                      {pickLocalized(item.q, locale)}
                    </span>
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full border border-line transition-colors",
                        open ? "border-ink bg-ink text-bg" : "text-ink"
                      )}
                    >
                      {open ? (
                        <Minus className="size-3.5" aria-hidden />
                      ) : (
                        <Plus className="size-3.5" aria-hidden />
                      )}
                    </span>
                  </button>
                  <div
                    className={cn(
                      "grid overflow-hidden transition-[grid-template-rows] duration-300 ease-premium",
                      open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    )}
                  >
                    <div className="min-h-0">
                      <p className="pb-6 pe-12 text-sm leading-relaxed text-muted md:text-[15px]">
                        {pickLocalized(item.a, locale)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </section>
  );
}
