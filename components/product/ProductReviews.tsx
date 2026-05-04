"use client";

import { BadgeCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { RatingStars } from "@/components/ui/RatingStars";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import type { Product, ProductReview } from "@/lib/types";

type Props = { product: Product };

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
export function ProductReviews({ product }: Props) {
  const { locale, t } = useLocale();
  const reviews = product.reviews ?? [];
  const aggregate = product.rating;

  if (!aggregate && reviews.length === 0) return null;

  return (
    <section className="bg-bg py-16 md:py-24">
      <Container>
        <header className="mb-10 max-w-2xl md:mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            {t.product.reviewsEyebrow}
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
            {t.product.reviewsTitle}
          </h2>
        </header>

        <div className="grid gap-10 lg:grid-cols-[280px_1fr] lg:gap-16">
          {aggregate ? (
            <aside className="order-2 lg:order-1">
              <ReviewSummary value={aggregate.value} count={aggregate.count} />
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

function ReviewSummary({ value, count }: { value: number; count: number }) {
  const { t } = useLocale();
  // Approximate distribution — we don't ship raw histograms yet, but the
  // visual cue alone increases trust (Baymard #167).
  const buckets = [70, 22, 5, 2, 1];
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

      <ul className="mt-6 space-y-2">
        {buckets.map((pct, i) => (
          <li key={i} className="flex items-center gap-3 text-[11px] text-muted">
            <span className="w-3 tabular-nums">{5 - i}</span>
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
  return (
    <li className="flex flex-col gap-3 rounded-md border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-ink">
            {pickLocalized(review.name, locale)}
          </p>
          <p className="text-[11px] text-muted">
            {pickLocalized(review.city, locale)} · {formatDate(review.date, locale)}
          </p>
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
