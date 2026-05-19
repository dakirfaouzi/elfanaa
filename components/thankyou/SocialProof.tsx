"use client";

import { Star, Quote } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

type Testimonial = {
  name: string;
  meta: string;
  body: string;
};

/**
 * SocialProof — Saudi customer testimonials, on the thank-you page.
 *
 * **Pre-purchase** testimonials sell the product.  **Post-purchase**
 * testimonials sell the *delivery*.  Same testimonial type, different
 * job-to-be-done: convince the buyer that other customers in Riyadh,
 * Jeddah, Dammam, Khobar also waited two days for the box and were
 * happy when it arrived.
 *
 * Authenticity rules followed:
 *   • Real city + age — no "from Saudi Arabia, 30 years old"
 *     placeholder feel.
 *   • Specific copy — "the call was under a minute", "ordered, no
 *     problems, fast delivery" — concrete details over superlatives.
 *   • No exclamation-mark spam, no all-caps, no "miracle".  K-beauty
 *     funnel buyers smell scam copy from a mile away.
 *
 * Layout: 3 cards on md+ (single-row, balanced), single-column stack
 * on mobile.  No carousel — a fixed grid reads as confident, a swipe
 * carousel reads as trying to fill space.
 */
export function SocialProof() {
  const { t } = useLocale();

  const testimonials: Testimonial[] = [
    {
      name: t.thankyou.socialT1Name,
      meta: t.thankyou.socialT1Meta,
      body: t.thankyou.socialT1Body,
    },
    {
      name: t.thankyou.socialT2Name,
      meta: t.thankyou.socialT2Meta,
      body: t.thankyou.socialT2Body,
    },
    {
      name: t.thankyou.socialT3Name,
      meta: t.thankyou.socialT3Meta,
      body: t.thankyou.socialT3Body,
    },
    {
      name: t.thankyou.socialT4Name,
      meta: t.thankyou.socialT4Meta,
      body: t.thankyou.socialT4Body,
    },
  ];

  return (
    <section
      aria-labelledby="ty-social-title"
      className="bg-bg py-12 md:py-16"
    >
      <Container>
        <header className="mb-8 md:mb-10">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[rgb(var(--color-accent-deep))]">
            {t.thankyou.socialEyebrow}
          </p>
          <div className="mt-1.5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between md:gap-6">
            <h2
              id="ty-social-title"
              className="font-display text-[22px] font-semibold tracking-tight text-ink md:text-3xl"
            >
              {t.thankyou.socialTitle}
            </h2>
            {/* Rating + count microcopy.  Inline star row keeps the
             *  aggregate trust signal scannable in one glance. */}
            <div className="flex items-center gap-3 text-[12.5px] text-muted md:text-[13px]">
              <span aria-hidden className="inline-flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="size-3.5 fill-[rgb(var(--color-accent))] text-[rgb(var(--color-accent))]"
                    strokeWidth={0}
                  />
                ))}
              </span>
              <span className="font-semibold text-ink/80">
                {t.thankyou.socialRating}
              </span>
              <span aria-hidden className="text-line">•</span>
              <span>{t.thankyou.socialReviewCount}</span>
            </div>
          </div>
        </header>

        {/* 4 cards on xl, 3 on md, 1 on mobile.  Grid wraps so the
         *  layout never gets unbalanced on tablet portrait. */}
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-4">
          {testimonials.map((tt) => (
            <li
              key={tt.name}
              className="relative flex flex-col gap-4 rounded-2xl border border-line/80 bg-surface/60 p-5 shadow-luxury-sm md:p-6"
            >
              {/* Stars + quote glyph row */}
              <div className="flex items-center justify-between">
                <span aria-hidden className="inline-flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="size-3.5 fill-[rgb(var(--color-accent))] text-[rgb(var(--color-accent))]"
                      strokeWidth={0}
                    />
                  ))}
                </span>
                <Quote
                  aria-hidden
                  className="size-4 text-[rgb(var(--color-accent-soft))]"
                  strokeWidth={1.5}
                />
              </div>

              <p className="text-[13.5px] leading-relaxed text-ink md:text-[14.5px]">
                {tt.body}
              </p>

              <footer className="mt-auto border-t border-line/60 pt-3.5">
                <p className="text-[13px] font-semibold text-ink md:text-[14px]">
                  {tt.name}
                </p>
                <p className="text-[11.5px] text-muted md:text-[12px]">
                  {tt.meta}
                </p>
              </footer>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
