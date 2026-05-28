"use client";

import Image from "next/image";
import { Sparkles, Wallet, Truck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { getProductById } from "@/data/products";
import { pickLocalized } from "@/lib/format";
import { PLACEHOLDER_PRODUCT_IMAGE } from "@/lib/product-image";
import type { OrderReceipt as Receipt } from "@/lib/order-receipt";

type Props = {
  receipt: Receipt;
};

/**
 * PremiumOrderSummary — the "this is exactly what you bought" panel.
 *
 * Hard requirements baked into the design:
 *   • Fully **dynamic**.  Renders `receipt.lines[]` verbatim — no fixed
 *     slots, no "base + upsell + cross-sell" assumptions in the UI.  A
 *     base order can have 1 line; a stacked funnel can have 10.  Same
 *     component, same code-path.
 *   • RTL-safe.  All flex/grid uses `gap` (not margin-side hacks),
 *     borders use `border-s` / `border-e`, and currency rendering uses
 *     `font-variant-numeric: tabular-nums` so digits don't shift between
 *     AR and EN.
 *   • Print-safe.  Inherits the print stylesheet from `tokens.css` so
 *     the hero "Print receipt" button still produces a clean A4 copy.
 *
 * Visual brief:
 *   • Each product row gets generous breathing room (90+ px tall vs.
 *     the previous 64) — image becomes a hero, title gets two lines,
 *     qty + unit price sit on a clear secondary baseline, line total
 *     anchors the trailing edge.
 *   • Totals block is visually weightier — large display-serif total,
 *     pill-shaped COD badge, free-shipping reassurance line so the
 *     final number never lands as a surprise.
 *   • Upsell lines are subtly badged (gold chip) but don't disrupt the
 *     row rhythm — they belong in the order, not above it.
 */
export function OrderReceipt({ receipt }: Props) {
  const { locale, t } = useLocale();
  const format = useFormatPrice();

  const itemCount = receipt.lines.reduce((acc, l) => acc + l.quantity, 0);
  const itemCountLabel =
    locale === "ar"
      ? itemCount === 1
        ? t.thankyou.summaryItemCountSingle
        : t.thankyou.summaryItemCountPlural
      : itemCount === 1
        ? t.thankyou.summaryItemCountSingle
        : t.thankyou.summaryItemCountPlural;

  return (
    <section
      aria-labelledby="ty-summary-title"
      className="bg-surface py-12 md:py-16"
    >
      <Container size="md">
        <header className="mb-6 flex items-end justify-between gap-4 md:mb-8">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[rgb(var(--color-accent-deep))]">
              {t.thankyou.summaryEyebrow}
            </p>
            <h2
              id="ty-summary-title"
              className="mt-1.5 font-display text-[22px] font-semibold tracking-tight text-ink md:text-3xl"
            >
              {t.thankyou.summaryTitle}
            </h2>
          </div>
          <span className="hidden text-[12px] text-muted md:inline-flex md:items-center md:gap-1.5">
            <span className="font-mono tabular-nums text-ink/80">{itemCount}</span>{" "}
            <span>{itemCountLabel}</span>
          </span>
        </header>

        <article className="overflow-hidden rounded-2xl border border-line bg-bg shadow-luxury-md">
          {/* ── LINE ITEMS ─────────────────────────────────────────────
           *  Each row is a flex container with generous gap so the image,
           *  copy, and price never crowd each other.  Dynamic length:
           *  the receipt may have 1 line or 12 — same component handles
           *  both. */}
          <ul className="divide-y divide-line/60 px-4 md:px-6">
            {receipt.lines.map((line) => {
              const product = getProductById(line.productId);
              /*
               * Image resolution is double-defensive:
               *   1. `product?.images?.[0]` short-circuits on either
               *      missing snapshot product (AI-generated SKUs whose
               *      slug-keyed id misses the snapshot lookup) OR a
               *      malformed snapshot that lost its `images` array.
               *      The Phase 2.4.1 crash report cited this exact
               *      `app/thank-you/[orderId]/page.js` chunk because
               *      the old `product?.images[0]` form threw on the
               *      second case (optional chaining only protects the
               *      first segment of the access path).
               *   2. The `??` tail falls back to the storefront
               *      placeholder so the receipt row always renders a
               *      thumbnail — an empty `<div>` looked broken next
               *      to the line title.
               * Both fallbacks fire in the same render slot so the
               * RTL/LTR layout is identical regardless of which one
               * wins.
               */
              const image = product?.images?.[0] ?? PLACEHOLDER_PRODUCT_IMAGE;
              const isUpsell = line.source === "post_purchase_upsell";
              return (
                <li
                  key={`${line.productId}-${line.source}`}
                  className="flex items-start gap-4 py-4 md:gap-5 md:py-5"
                >
                  {/* Product image — premium framed thumbnail. */}
                  <div className="relative size-[72px] shrink-0 overflow-hidden rounded-xl bg-brand-soft ring-1 ring-line/70 md:size-[88px]">
                    <Image
                      src={image.src}
                      alt={pickLocalized(image.alt, locale)}
                      fill
                      sizes="(min-width: 768px) 88px, 72px"
                      className="object-cover"
                    />
                  </div>

                  {/* Copy + price.  On mobile the price stacks under the
                   *  meta line for breathing room; on md+ the price hugs
                   *  the trailing edge of the row. */}
                  <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1.5">
                    <h3 className="col-span-2 line-clamp-2 text-[14.5px] font-medium leading-snug text-ink md:col-span-1 md:text-[15px]">
                      {pickLocalized(line.title, locale)}
                    </h3>
                    <span className="col-start-2 row-start-1 shrink-0 self-start font-display text-[15px] font-semibold tabular-nums text-ink md:text-base">
                      {format(line.lineTotal)}
                    </span>

                    {/* Qty + unit-price meta line — RTL-safe via gap, no
                     *  margins.  Subtle separator dot keeps it readable. */}
                    <p className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted md:text-[13px]">
                      <span>
                        {t.thankyou.summaryItemQty}:{" "}
                        <span className="font-medium tabular-nums text-ink/80">
                          {line.quantity}
                        </span>
                      </span>
                      <span aria-hidden className="text-line">•</span>
                      <span>
                        {format(line.unitPrice)} /{" "}
                        <span className="text-ink/70">
                          {t.thankyou.summaryItemUnit}
                        </span>
                      </span>
                    </p>

                    {isUpsell ? (
                      <span className="col-span-2 inline-flex w-fit items-center gap-1 rounded-full bg-[rgb(var(--color-accent-soft)/0.45)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[rgb(var(--color-accent-deep))] ring-1 ring-accent/30">
                        <Sparkles className="size-2.5" strokeWidth={2.5} />
                        {t.thankyou.receiptUpsellTag}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* ── TOTALS ───────────────────────────────────────────────── */}
          <div className="border-t border-line/80 bg-[rgb(var(--color-bg)/0.5)] px-5 py-5 md:px-7 md:py-6">
            <dl className="space-y-2.5 text-[14px] md:text-[14.5px]">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">{t.thankyou.summarySubtotal}</dt>
                <dd className="font-medium tabular-nums text-ink/90">
                  {format(receipt.totals.subtotal)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="flex items-center gap-2 text-muted">
                  <Truck className="size-3.5 text-[rgb(var(--color-accent-deep))]" />
                  <span>{t.thankyou.summaryShipping}</span>
                </dt>
                <dd className="inline-flex items-center gap-2 text-success">
                  <span className="font-medium">
                    {t.thankyou.summaryShippingFree}
                  </span>
                </dd>
              </div>
              <p className="text-[11.5px] text-muted/80 md:text-[12px]">
                {t.thankyou.summaryShippingNote}
              </p>

              {/* Final total — display-serif, oversized, anchored by a
               *  pill-shaped COD badge so it never reads as "pay now". */}
              <div className="mt-3 flex flex-col gap-3 border-t border-line/80 pt-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-bg">
                    <Wallet className="size-3.5" strokeWidth={2} />
                    {t.thankyou.summaryCodBadge}
                  </span>
                  <span className="text-[12.5px] text-muted md:text-[13px]">
                    {t.thankyou.summaryTotalNote}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted md:text-[12px]">
                    {t.thankyou.summaryTotal}
                  </span>
                  <span className="font-display text-[22px] font-semibold tabular-nums text-ink md:text-2xl">
                    {format(receipt.totals.total)}
                  </span>
                </div>
              </div>
            </dl>
          </div>
        </article>
      </Container>
    </section>
  );
}
