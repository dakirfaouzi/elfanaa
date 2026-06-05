"use client";

import { BadgeCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { RatingStars } from "@/components/ui/RatingStars";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import { SectionFigure } from "@/components/product/SectionFigure";
import type { Product, ProductImage, ProductReview } from "@/lib/types";

type Props = { product: Product; image?: ProductImage };

/**
 * Reviews — qualitative + quantitative.
 *
 * Layout:
 *   • Left rail: average rating + count + bar distribution.
 *   • Right grid: 4 review cards (name, city, rating, body, date,
 *     verified badge). City + verified are the two trust handles
 *     unique to a Saudi DTC funnel — they convert better than star
 *     count alone.
 *
 * Falls back gracefully if the product has only an aggregated rating
 * but no reviews authored yet.
 */
export function ProductReviews({ product, image }: Props) {
  const { locale, t } = useLocale();
  const reviews = product.reviews ?? [];
  const aggregate = product.rating;

  if (!aggregate && reviews.length === 0) return null;

  return (
    <section className="fn-section-y bg-bg">
      <Container>
        {image ? (
          <div className="mb-10 max-w-3xl md:mb-12">
            <SectionFigure image={image} aspectClassName="aspect-[5/4]" />
          </div>
        ) : null}
        <header className="mb-10 max-w-2xl md:mb-14">
          <p className="fn-eyebrow">
            <span className="fn-rule" />
            <span>{t.product.reviewsEyebrow}</span>
          </p>
          <h2 className="fn-section-title mt-4 md:mt-5">
            {t.product.reviewsTitle}
          </h2>
        </header>

        <div className="grid gap-10 lg:grid-cols-[280px_1fr] lg:gap-16">
          {aggregate ? (
            <aside className="order-2 lg:order-1">
              <ReviewSummary
                value={aggregate.value}
                count={aggregate.count}
                reviews={reviews}
              />
            </aside>
          ) : null}

          <ul className="order-1 grid gap-4 sm:grid-cols-2 lg:order-2 lg:gap-6">
            {reviews.slice(0, 4).map((r, i) => (
              <ReviewCard key={i} review={r} locale={locale} verifiedLabel={t.product.reviewsVerified} />
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

/**
 * Computes a REAL 5→1 star distribution from the visible reviews — but only
 * when those reviews fully back the aggregate (`reviews.length === count`).
 *
 * Previously this rendered a hardcoded `[70,22,5,2,1]` histogram regardless of
 * data — a manufactured trust signal that risks the exact credibility the
 * section exists to build (Sprint A #1). When the aggregate `count` is larger
 * than the reviews we actually have, we have no honest per-star breakdown, so
 * we omit the bars entirely rather than fabricate them.
 *
 * Returns `null` when there isn't enough genuine data to draw the bars.
 */
function realStarDistribution(
  reviews: ProductReview[],
  count: number,
): { star: number; pct: number; n: number }[] | null {
  const n = reviews.length;
  // Only trustworthy when every aggregated review is present and accounted for.
  if (n === 0 || n !== count) return null;
  const tally = [0, 0, 0, 0, 0]; // index 0 → 5★ … index 4 → 1★
  for (const r of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(r.rating)));
    tally[5 - star] += 1;
  }
  return tally.map((c, i) => ({
    star: 5 - i,
    n: c,
    pct: Math.round((c / n) * 100),
  }));
}

function ReviewSummary({
  value,
  count,
  reviews,
}: {
  value: number;
  count: number;
  reviews: ProductReview[];
}) {
  const { t } = useLocale();
  const distribution = realStarDistribution(reviews, count);
  return (
    <div className="rounded-md border border-line bg-surface p-6">
      <p className="text-xs text-muted">{t.product.reviewsAverage}</p>
      <p className="mt-1 inline-flex items-baseline gap-2">
        <span className="font-display text-5xl font-semibold tabular-nums">
          {value.toFixed(1)}
        </span>
        <span className="text-sm text-muted">/ 5</span>
      </p>
      <RatingStars value={value} size="lg" className="mt-2" />
      <p className="mt-2 text-xs text-muted">
        {t.product.reviewsBasedOn.replace("{count}", String(count))}
      </p>

      {/* Real per-star bars — only when the data honestly supports them.
          When the aggregate count exceeds the reviews we have, we show the
          average + count only rather than an invented breakdown. */}
      {distribution ? (
        <ul className="mt-6 space-y-2">
          {distribution.map(({ star, pct }) => (
            <li
              key={star}
              className="flex items-center gap-3 text-[11px] text-muted"
            >
              <span className="w-3 tabular-nums">{star}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <span
                  className="block h-full bg-accent"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="w-7 text-end tabular-nums">{pct}%</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ReviewCard({
  review,
  locale,
  verifiedLabel,
}: {
  review: ProductReview;
  locale: "ar" | "en";
  verifiedLabel: string;
}) {
  const name = pickLocalized(review.name, locale);
  const initials = name.trim().slice(0, 1).toUpperCase() || "★";
  return (
    <li className="flex flex-col gap-3 rounded-md border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/15 text-[15px] font-semibold text-accent ring-1 ring-accent/25"
            aria-hidden
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink">{name}</p>
            <p className="text-[11px] text-muted">
              {pickLocalized(review.city, locale)} · {formatDate(review.date, locale)}
            </p>
          </div>
        </div>
        <RatingStars value={review.rating} size="sm" />
      </div>

      <p className="text-sm leading-relaxed text-ink/85">
        {pickLocalized(review.body, locale)}
      </p>

      {review.verified ? (
        <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success">
          <BadgeCheck className="size-3.5" aria-hidden />
          {verifiedLabel}
        </p>
      ) : null}
    </li>
  );
}

function formatDate(iso: string, locale: "ar" | "en"): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}
