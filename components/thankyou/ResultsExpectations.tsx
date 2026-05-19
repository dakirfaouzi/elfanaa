"use client";

import { Sparkle } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

type ResultStep = {
  number: string;
  title: string;
  body: string;
};

/**
 * ResultsExpectations — "When will I see results?".
 *
 * Why this section exists at ALL on a confirmation page:
 *   Beauty/wellness customers cancel COD orders when their expectations
 *   are mismatched — they expect day-3 miracles, panic on day 8, and
 *   refuse the courier on day 10.  Setting honest, time-anchored
 *   expectations *before the box arrives* lifts the delivery acceptance
 *   rate measurably (research from K-beauty COD funnels: 4–7 points).
 *
 * Tone discipline:
 *   • Day-by-day, not result-by-result.  We anchor on time so the buyer
 *     remembers "by week 3 I should see clearer skin" — not "after one
 *     dose I'll glow".
 *   • Honest disclaimer at the bottom — "results vary".  Sounds boring,
 *     reads as trustworthy, and protects the brand from refund disputes.
 *   • Visual: three numbered gold chips, vertical-card layout for
 *     mobile-first rhythm.  No icons-per-step — the number IS the
 *     identifier and we already use icons up in the journey timeline.
 */
export function ResultsExpectations() {
  const { t } = useLocale();

  const steps: ResultStep[] = [
    {
      number: "1",
      title: t.thankyou.resultsStep1Title,
      body: t.thankyou.resultsStep1Body,
    },
    {
      number: "2",
      title: t.thankyou.resultsStep2Title,
      body: t.thankyou.resultsStep2Body,
    },
    {
      number: "3",
      title: t.thankyou.resultsStep3Title,
      body: t.thankyou.resultsStep3Body,
    },
  ];

  return (
    <section
      aria-labelledby="ty-results-title"
      className="bg-surface py-12 md:py-16"
    >
      <Container size="md">
        <header className="mb-8 md:mb-10">
          <p className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[rgb(var(--color-accent-deep))]">
            <Sparkle className="size-3" strokeWidth={2.25} />
            {t.thankyou.resultsEyebrow}
          </p>
          <h2
            id="ty-results-title"
            className="mt-1.5 font-display text-[22px] font-semibold tracking-tight text-ink md:text-3xl"
          >
            {t.thankyou.resultsTitle}
          </h2>
          <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-muted md:text-[15px]">
            {t.thankyou.resultsSubtitle}
          </p>
        </header>

        <ol className="space-y-4 md:space-y-5">
          {steps.map((step) => (
            <li
              key={step.number}
              className="flex items-start gap-4 rounded-2xl border border-line/80 bg-bg p-5 shadow-luxury-sm md:gap-5 md:p-6"
            >
              {/* Numbered gold chip — large enough to scan from a phone. */}
              <span
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[rgb(var(--color-accent-soft))] to-[rgb(var(--color-accent))] font-display text-[17px] font-semibold text-ink shadow-luxury-sm md:size-12 md:text-[19px]"
              >
                {step.number}
              </span>

              <div className="min-w-0 flex-1 space-y-1.5">
                <h3 className="font-display text-[16.5px] font-semibold tracking-tight text-ink md:text-lg">
                  {step.title}
                </h3>
                <p className="text-[13.5px] leading-relaxed text-muted md:text-[14.5px]">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {/* Honesty disclaimer — small, gold-tinted left rail, doesn't
         *  scream but anchors the section as trustworthy. */}
        <p className="mt-6 border-s-2 border-accent/30 ps-3 text-[12.5px] leading-relaxed text-muted md:mt-7 md:text-[13px]">
          {t.thankyou.resultsDisclaimer}
        </p>
      </Container>
    </section>
  );
}
