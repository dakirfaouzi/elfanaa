"use client";

import { Flourish } from "@/components/brand/Flourish";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import type { Collection } from "@/lib/types";

type ShopHeaderProps = {
  collection?: Collection;
  itemCount: number;
};

/**
 * Editorial header for the shop / collection page.
 *
 * Premium DTC playbook (Jenni Kayne, Article, Aesop): the listing page
 * is treated as a *page* — eyebrow, title, flourish, body — not a
 * search results UI. The customer should feel curated *before* the
 * grid even renders.
 *
 * Renders different copy for the all-products view vs. a single
 * collection. Item count is shown as a soft tabular caption — not a
 * search facet (we'll never have hundreds of SKUs at launch, and the
 * count is more reassuring than functional).
 */
export function ShopHeader({ collection, itemCount }: ShopHeaderProps) {
  const { t, locale } = useLocale();
  const eyebrow = collection
    ? `${t.shop.heroTitlePrefix} · ${pickLocalized(collection.title, locale)}`
    : t.shop.heroEyebrow;
  const title = collection
    ? pickLocalized(collection.title, locale)
    : t.shop.heroTitleAll;
  const body = collection ? null : t.shop.heroBodyAll;

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto max-w-content px-6 py-12 md:py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          {eyebrow}
        </p>
        <h1 className="mt-3 max-w-2xl whitespace-pre-line font-display text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl lg:text-6xl">
          {title}
        </h1>
        <Flourish className="mt-5 text-accent" width={140} />
        {body ? (
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted md:text-[17px]">
            {body}
          </p>
        ) : null}
        <p className="mt-6 text-xs uppercase tracking-[0.16em] text-muted tabular-nums">
          {t.shop.itemsLabel.replace("{count}", String(itemCount))}
        </p>
      </div>
    </header>
  );
}
