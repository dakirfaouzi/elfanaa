"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Flourish } from "@/components/brand";
import { useLocale } from "@/hooks/useLocale";
import { legalContent, type PolicyKey } from "@/data/legal";

/**
 * PolicyPage — the shared editorial layout for every static policy route
 * (privacy, terms, shipping/returns, FAQ).
 *
 * One component keeps all four pages visually identical to the rest of the
 * storefront: warm cream canvas, display headline, rose-gold eyebrow + flourish,
 * and a comfortable measure for long-form reading. RTL is inherited from the
 * document `dir`, so Arabic reads right-to-left with no extra wiring.
 *
 * Two render modes, chosen by the content shape:
 *   • `faqs[]`     → native `<details>` accordion (zero-JS, a11y-free, like
 *                    `ThankYouFAQ`).
 *   • `sections[]` → prose document with sub-headings and paragraphs.
 */
export function PolicyPage({ docKey }: { docKey: PolicyKey }) {
  const { locale, t } = useLocale();
  const doc = legalContent[docKey][locale];

  return (
    <article className="bg-bg py-14 md:py-20">
      <Container size="md">
        <header className="mb-10 md:mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgb(var(--color-accent-deep))]">
            {doc.eyebrow}
          </p>
          <h1 className="mt-2 text-balance font-display text-4xl font-semibold leading-[1.1] tracking-tight text-ink md:text-5xl">
            {doc.title}
          </h1>
          <Flourish width={120} className="mt-5 text-accent" />
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted md:text-[17px]">
            {doc.intro}
          </p>
          <p className="mt-4 text-xs text-muted/70">{doc.updated}</p>
        </header>

        {doc.faqs ? (
          <ul className="space-y-2.5 md:space-y-3">
            {doc.faqs.map((item, idx) => (
              <li key={item.q}>
                <details
                  className="group overflow-hidden rounded-2xl border border-line/80 bg-surface/50 open:border-line open:shadow-luxury-sm"
                  open={idx === 0}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-start text-[15px] font-medium text-ink md:px-6 md:py-5 md:text-base">
                    <span className="flex-1">{item.q}</span>
                    <ChevronDown
                      aria-hidden
                      className="size-4 shrink-0 text-muted transition-transform duration-300 ease-premium group-open:rotate-180"
                      strokeWidth={2}
                    />
                  </summary>
                  <div className="border-t border-line/60 px-5 py-4 text-[14px] leading-relaxed text-muted md:px-6 md:py-5 md:text-[15px]">
                    {item.a}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <div className="max-w-2xl space-y-10">
            {doc.sections?.map((section) => (
              <section key={section.heading}>
                <h2 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-[28px]">
                  {section.heading}
                </h2>
                <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted md:text-base">
                  {section.body.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-14 border-t border-line/70 pt-8">
          <Link
            href="/shop"
            className="inline-flex h-11 items-center rounded-md bg-ink px-6 text-sm font-medium text-bg transition-colors hover:bg-ink/90"
          >
            {t.thankyou.backToShop}
          </Link>
        </div>
      </Container>
    </article>
  );
}
