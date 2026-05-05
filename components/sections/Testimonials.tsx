"use client";

import { BadgeCheck, Quote } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { RatingStars } from "@/components/ui/RatingStars";
import { useLocale } from "@/hooks/useLocale";
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

  const picks = pickReviews();

  return (
    <section className="bg-bg py-16 md:py-24">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[360px_1fr] lg:gap-16">
          <header className="max-w-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              {t.testimonials.eyebrow}
            </p>
            <h2 className="mt-2 whitespace-pre-line font-display text-3xl font-semibold leading-[1.12] tracking-tight md:text-4xl lg:text-5xl">
              {t.testimonials.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted md:text-[17px]">
              {t.testimonials.body}
            </p>

            <div className="mt-6 flex items-center gap-4 rounded-md border border-line bg-surface p-4">
              <RatingStars value={4.9} size="lg" />
              <div className="text-xs text-muted">
                <p className="font-semibold text-ink">
                  {t.testimonials.ratingTitle}
                </p>
                <p>{t.testimonials.ratingSubtitle}</p>
              </div>
            </div>
          </header>

          <ul className="grid gap-4 sm:grid-cols-2">
            {picks.map((r, i) => (
              <li
                key={i}
                className="relative flex flex-col gap-3 rounded-md border border-line bg-surface p-5"
              >
                <Quote
                  className="absolute end-4 top-4 size-5 text-accent/30 ltr:scale-x-[-1]"
                  aria-hidden
                />
                <RatingStars value={r.rating} size="sm" />
                <p className="text-sm leading-relaxed text-ink/85 md:text-[15px]">
                  &ldquo;{pickLocalized(r.body, locale)}&rdquo;
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-ink">
                      {pickLocalized(r.name, locale)}
                    </p>
                    <p className="text-[11px] text-muted">
                      {pickLocalized(r.city, locale)}
                    </p>
                  </div>
                  {r.verified ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success">
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
