"use client";

import { Check } from "lucide-react";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { useLocale } from "@/hooks/useLocale";
import { lineTotal } from "@/lib/pricing";
import { cn } from "@/lib/cn";
import type { Money, Product } from "@/lib/types";

type Props = {
  product: Product;
  selected: number;
  onSelect: (quantity: number) => void;
};

/**
 * Offer selector — three cards, one tap, the conversion centerpiece.
 *
 * Pattern lifted from the highest-converting Saudi COD funnels (CODRocket
 * + Mada Pay + EasySell teardowns):
 *
 *   • Three side-by-side cards (1 / 2 / 3) — never four; choice paralysis
 *     starts at four.
 *   • The middle card is "Most popular" — it always wins because the
 *     anchor effect makes 2 feel like the obvious compromise.
 *   • The right card carries "Best value" + savings — captures the
 *     deal-seeker without making the single look bad.
 *   • Each card shows the LINE total in big, the per-piece price in
 *     small, and the savings badge when there's something to save.
 *   • Selection state is managed by the parent so the sticky CTA and
 *     mobile bar can read the same `selected` quantity.
 *
 * Mobile: cards stack to a 3-column grid that stays readable down to 320px
 * because the per-piece line is the only text that can collapse to two
 * digits at the smallest screens.
 */
export function OfferSelector({ product, selected, onSelect }: Props) {
  const { t, locale } = useLocale();
  const format = useFormatPrice();
  const tiers = product.offerTiers;

  if (!tiers || tiers.length === 0) {
    // Fallback for products without tier pricing — surface a single card.
    return (
      <div className="rounded-md border border-line bg-bg p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-ink">{t.product.offerSingle}</span>
          <span className="font-display text-2xl font-semibold tabular-nums">
            {format(product.price)}
          </span>
        </div>
      </div>
    );
  }

  const sorted = [...tiers].sort((a, b) => a.quantity - b.quantity);
  const baseUnit = product.price.amount;
  const labels = [t.product.offerSingle, t.product.offerPair, t.product.offerTrio];

  return (
    <fieldset className="space-y-3" aria-label={t.product.pickYourOffer}>
      <legend className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        {t.product.pickYourOffer}
      </legend>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {sorted.map((tier, idx) => {
          const isSelected = tier.quantity === selected;
          const isMiddle = idx === 1;
          const isLast = idx === sorted.length - 1;
          const baselineTotal = baseUnit * tier.quantity;
          const savings: Money = {
            amount: Math.max(0, baselineTotal - tier.total.amount),
            currency: tier.total.currency,
          };
          const perUnit: Money = {
            amount: Math.round(tier.total.amount / tier.quantity),
            currency: tier.total.currency,
          };

          // Marketing badge — middle card is "Most popular", last is "Best value".
          const badge =
            tier.quantity === 1
              ? null
              : isLast
                ? t.product.bestValue
                : isMiddle
                  ? t.product.mostPopular
                  : null;

          return (
            <button
              key={tier.quantity}
              type="button"
              onClick={() => onSelect(tier.quantity)}
              aria-pressed={isSelected}
              className={cn(
                "group relative flex flex-col items-stretch rounded-md border p-3 text-start transition-all duration-200 ease-premium sm:p-4",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30",
                isSelected
                  ? "border-ink bg-ink/[0.03] shadow-card"
                  : "border-line bg-bg hover:border-ink/40 hover:shadow-card"
              )}
            >
              {badge ? (
                <span
                  className={cn(
                    "absolute -top-2 inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold uppercase tracking-[0.1em]",
                    "ltr:left-3 rtl:right-3",
                    isLast
                      ? "bg-success/15 text-success"
                      : "bg-accent/15 text-accent"
                  )}
                >
                  {badge}
                </span>
              ) : null}

              <div className="flex items-start justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink sm:text-sm">
                  {labels[idx] ?? `× ${tier.quantity}`}
                </span>
                {isSelected ? (
                  <Check className="size-4 text-ink" aria-hidden />
                ) : (
                  <span
                    className="size-4 rounded-full border border-line group-hover:border-ink/40"
                    aria-hidden
                  />
                )}
              </div>

              <div className="mt-2 flex items-baseline gap-1">
                <span
                  className={cn(
                    "font-display font-semibold tabular-nums leading-none",
                    "text-xl sm:text-2xl"
                  )}
                >
                  {format(tier.total)}
                </span>
              </div>

              <div className="mt-1 text-[11px] leading-tight text-muted">
                {format(perUnit)} · {t.product.perPiece}
              </div>

              {savings.amount > 0 ? (
                <div className="mt-2 inline-flex w-fit rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                  {locale === "ar" ? "وفّر" : "Save"} {format(savings)}
                </div>
              ) : (
                /* Spacer to keep cards equal height when the single card has no savings */
                <div className="mt-2 h-[18px]" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      {/* Live total under the cards — surfaces what the customer is about
          to commit to without scrolling, and recomputes from the same
          pricing engine the cart and the server use. */}
      <SelectedSummary
        total={lineTotal(product, selected)}
        quantity={selected}
      />
    </fieldset>
  );
}

function SelectedSummary({ total, quantity }: { total: Money; quantity: number }) {
  const { t, locale } = useLocale();
  const format = useFormatPrice();
  return (
    <div
      className="flex items-center justify-between rounded-md bg-brand-soft/60 px-4 py-2.5 text-sm"
      role="status"
    >
      <span className="text-muted">
        {locale === "ar" ? "المجموع" : "Total"} · ×{" "}
        <span className="tabular-nums">{quantity}</span>
      </span>
      <span className="inline-flex items-baseline gap-2">
        <span className="text-[11px] text-muted">{t.product.freeShipping}</span>
        <span className="font-display text-lg font-semibold tabular-nums">
          {format(total)}
        </span>
      </span>
    </div>
  );
}
