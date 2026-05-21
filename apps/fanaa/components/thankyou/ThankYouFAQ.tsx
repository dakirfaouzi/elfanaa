"use client";

import { ChevronDown } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

type QA = { q: string; a: string };

/**
 * ThankYouFAQ — accordion for the six most-common COD-objection questions.
 *
 * Engineering choice: native `<details>` / `<summary>` instead of a JS
 * accordion library.
 *   • Zero hydration cost — works the instant the HTML lands.
 *   • Native a11y semantics — keyboard, screen-reader, focus, all free.
 *   • RTL-aware — the chevron is positioned via `start`/`end` so it
 *     mirrors automatically when the surrounding `dir="rtl"` flips.
 *   • Print-friendly — a printed receipt shows all answers expanded.
 *
 * The questions are tuned to the specific objections that drive RTO in
 * Saudi COD: missed calls, "why is a strange Saudi number calling?",
 * cancellation, payment timing, shipping fees, missed-call recovery.
 * Each answer reduces a different reason a buyer might refuse delivery.
 */
export function ThankYouFAQ() {
  const { t } = useLocale();

  const items: QA[] = [
    { q: t.thankyou.faqQ1, a: t.thankyou.faqA1 },
    { q: t.thankyou.faqQ2, a: t.thankyou.faqA2 },
    { q: t.thankyou.faqQ3, a: t.thankyou.faqA3 },
    { q: t.thankyou.faqQ4, a: t.thankyou.faqA4 },
    { q: t.thankyou.faqQ5, a: t.thankyou.faqA5 },
    { q: t.thankyou.faqQ6, a: t.thankyou.faqA6 },
  ];

  return (
    <section
      aria-labelledby="ty-faq-title"
      className="bg-surface py-12 md:py-16"
    >
      <Container size="md">
        <header className="mb-7 md:mb-9">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[rgb(var(--color-accent-deep))]">
            {t.thankyou.faqEyebrow}
          </p>
          <h2
            id="ty-faq-title"
            className="mt-1.5 font-display text-[22px] font-semibold tracking-tight text-ink md:text-3xl"
          >
            {t.thankyou.faqTitle}
          </h2>
        </header>

        <ul className="space-y-2.5 md:space-y-3">
          {items.map((item, idx) => (
            <li key={item.q}>
              <details
                className="group overflow-hidden rounded-2xl border border-line/80 bg-bg open:border-line open:shadow-luxury-sm"
                /* The first item starts open so the buyer immediately
                 *  sees the accordion is interactive, without needing a
                 *  hint label. */
                open={idx === 0}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-start text-[14.5px] font-medium text-ink transition-colors hover:text-ink md:px-6 md:py-5 md:text-[15.5px]">
                  <span className="flex-1">{item.q}</span>
                  <ChevronDown
                    aria-hidden
                    className="size-4 shrink-0 text-muted transition-transform duration-300 ease-premium group-open:rotate-180"
                    strokeWidth={2}
                  />
                </summary>
                <div className="border-t border-line/60 bg-surface/50 px-5 py-4 text-[13.5px] leading-relaxed text-muted md:px-6 md:py-5 md:text-[14.5px]">
                  {item.a}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
