"use client";

import { BadgeCheck, Quote } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { RatingStars } from "@/components/ui/RatingStars";
import { useLocale } from "@/hooks/useLocale";
import { useInView } from "@/hooks/useInView";
import { cn } from "@/lib/cn";
import { products } from "@/data/products";
import { pickLocalized } from "@/lib/format";
import type { ProductReview } from "@/lib/types";

/**
 * Home-page testimonial band.
 *
 * Sources four of the highest-rated, geographically diverse reviews from
 * the catalog — Riyadh, Jeddah, Dammam, Abha — so the customer recognises
 * a city like theirs and the social proof feels local, not stock-photo.
 *
 * Layout matches the brand's editorial sections: eyebrow → title → body
 * → 4 cards. The review card mirrors the PDP review card (same anatomy,
 * different chrome) so the design system feels coherent across surfaces.
 */
export function Testimonials() {
  const { t, locale } = useLocale();
  const { ref: sectionRef, inView } = useInView({ threshold: 0.06 });

  const picks = pickReviews();

  return (
    <section className="fn-section-y bg-bg">
      <Container>
        <div
          ref={sectionRef as React.RefObject<HTMLDivElement>}
          className={cn(
            "reveal grid gap-10 lg:grid-cols-[360px_1fr] lg:gap-16",
            inView && "in-view"
          )}
        >
          <header className="max-w-md">
            <p className="fn-eyebrow-step">
              <span className="fn-step-num">04</span>
              <span className="fn-step-rule" />
              <span>{t.testimonials.eyebrow}</span>
            </p>
            <h2 className="fn-section-title mt-4 md:mt-5">
              {t.testimonials.title}
            </h2>
            <p className="fn-section-lede mt-4 md:mt-5">
              {t.testimonials.body}
            </p>

            <div className="mt-7 flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 md:p-5">
              <RatingStars value={4.9} size="lg" />
              <div className="text-xs text-muted">
                <p className="font-semibold text-ink">
                  {t.testimonials.ratingTitle}
                </p>
                <p className="mt-0.5">{t.testimonials.ratingSubtitle}</p>
              </div>
            </div>
          </header>

          <ul className="grid gap-4 sm:grid-cols-2">
            {picks.map((r, i) => (
              <li
                key={i}
                className="relative flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-[0_4px_14px_rgba(31,24,21,0.04)] transition-all duration-300 ease-premium md:p-6 md:hover:border-accent/30 md:hover:shadow-[0_10px_30px_rgba(199,162,124,0.16)]"
              >
                <Quote
                  className="absolute end-4 top-4 size-5 text-accent/35 ltr:scale-x-[-1]"
                  aria-hidden
                />
                <RatingStars value={r.rating} size="sm" />
                <p className="text-[14.5px] leading-[1.8] text-ink/85 md:text-[15.5px]">
                  &ldquo;{pickLocalized(r.body, locale)}&rdquo;
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-ink">
                      {pickLocalized(r.name, locale)}
                    </p>
                    <p className="text-[11.5px] text-muted">
                      {pickLocalized(r.city, locale)}
                    </p>
                  </div>
                  {r.verified ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-success">
                      <BadgeCheck className="size-3.5" aria-hidden />
                      {locale === "ar" ? "موثّق" : "Verified"}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

/**
 * Picks one review per product (keeps the testimonial mix balanced)
 * preferring 5-star verified entries.
 */
function pickReviews(): ProductReview[] {
  return products
    .map((p) => {
      const reviews = p.reviews ?? [];
      return (
        reviews.find((r) => r.rating === 5 && r.verified) ?? reviews[0] ?? null
      );
    })
    .filter((r): r is ProductReview => Boolean(r))
    .slice(0, 4);
}
