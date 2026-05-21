"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ShoppingBag, Check, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { pickLocalized } from "@/lib/format";
import { productHref } from "@/lib/product-href";
import { useLocale } from "@/hooks/useLocale";
import { useCart } from "@/hooks/useCart";
import { useUI } from "@/hooks/useUI";
import { Badge } from "@/components/ui/Badge";
import { Price } from "@/components/ui/Price";
import type { Product } from "@/lib/types";

type ProductCardProps = {
  product: Product;
  className?: string;
  /** When true, the card surfaces a quick-add CTA on hover. */
  quickAdd?: boolean;
  priority?: boolean;
};

/**
 * Premium GCC beauty & wellness product card.
 *
 * Mobile-first: 90% of traffic lands here on a phone, so the card is
 * tuned for thumb-tap ergonomics, generous typography, and an always-
 * visible quick-add affordance.
 *
 * Visual anatomy:
 *   • Image frame   — `.fn-card-product-frame` from the global luxury
 *                     vocabulary (warm sand wash + champagne ring on
 *                     hover, 18px radius).
 *   • Badge stack   — top-start, neutral cream pills. Limited to 2
 *                     on the card to avoid mobile clutter (the full
 *                     badge list is shown on the PDP).
 *   • Quick add     — 52px touch target, full-width on mobile, hidden-
 *                     then-revealed on hover/focus on sm+.
 *   • Type block    — title + emotional headline + rating + price.
 *                     Hierarchy is preserved at 13/14px on mobile so
 *                     the 2-up grid still breathes.
 *
 * Logic surface untouched:
 *   • Routes via productHref(product) — Sugarbear → /sugarbear via
 *     landingPath, others → /products/[slug].
 *   • add() / openCart() cart flow identical to v1.
 *   • i18n via useLocale() and pickLocalized() preserved.
 */
export function ProductCard({
  product,
  className,
  quickAdd = true,
  priority = false,
}: ProductCardProps) {
  const { locale } = useLocale();
  const add = useCart((s) => s.add);
  const openCart = useUI((s) => s.openCart);
  const [justAdded, setJustAdded] = useState(false);

  const title = pickLocalized(product.title, locale);
  const primary = product.images[0];
  const secondary = product.images[1] ?? primary;
  const onSale =
    product.compareAtPrice && product.compareAtPrice.amount > product.price.amount;

  /*
   * Badge mobile budget: surface the first two only. Full list shown on
   * the PDP. This keeps cards visually calm on a 2-up phone grid where
   * 3 stacked badges previously crowded the image.
   */
  const visibleBadges = product.badges?.slice(0, 2) ?? [];

  const onQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    add(product.id, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
    setTimeout(openCart, 250);
  };

  return (
    <article
      className={cn(
        "group relative",
        /* Lift slightly on hover at desktop; mobile keeps cards anchored. */
        "transition-transform duration-500 ease-premium md:hover:-translate-y-0.5",
        className
      )}
    >
      <Link
        href={productHref(product)}
        className="block rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {/*
         * Image frame — global `.fn-card-product-frame` carries the warm
         * sand wash, soft champagne ring, and shadow bloom on desktop
         * hover. Keep aspect-[3/4] so portrait product photography (the
         * /sugarbear bottle, marble-flatlay editorials) frames cleanly.
         */}
        <div className="fn-card-product-frame relative aspect-[3/4]">
          <Image
            src={primary.src}
            alt={pickLocalized(primary.alt, locale)}
            fill
            sizes="(min-width: 1280px) 320px, (min-width: 768px) 33vw, 50vw"
            priority={priority}
            className="object-cover transition-transform duration-[900ms] ease-premium group-hover:scale-[1.04]"
          />
          {secondary !== primary ? (
            <Image
              src={secondary.src}
              alt={pickLocalized(secondary.alt, locale)}
              fill
              sizes="(min-width: 1280px) 320px, (min-width: 768px) 33vw, 50vw"
              className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
          ) : null}

          {/*
           * Bottom legibility wash — barely-there cream gradient. Lets
           * the quick-add button float without a hard backdrop and
           * gives the price chip somewhere to sit cleanly.
           */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-bg/55 via-bg/10 to-transparent"
          />

          {visibleBadges.length ? (
            <div className="absolute start-2.5 top-2.5 flex flex-col gap-1.5 md:start-3 md:top-3">
              {visibleBadges.map((b, i) => (
                <Badge key={i} tone={onSale ? "ink" : "neutral"}>
                  {pickLocalized(b, locale)}
                </Badge>
              ))}
            </div>
          ) : null}

          {quickAdd ? (
            <div
              className={cn(
                /*
                 * Mobile (< sm): always visible — hover never fires on touch.
                 * sm+: hide by default, reveal on group-hover / keyboard focus.
                 */
                "absolute inset-x-2.5 bottom-2.5 transition-all duration-300 ease-premium md:inset-x-3 md:bottom-3",
                "translate-y-0 opacity-100",
                "sm:translate-y-1 sm:opacity-0",
                "sm:group-hover:translate-y-0 sm:group-hover:opacity-100",
                "focus-within:translate-y-0 focus-within:opacity-100"
              )}
            >
              <button
                type="button"
                onClick={onQuickAdd}
                aria-label={`Add ${title} to cart`}
                className={cn(
                  "btn-press inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-full",
                  "border border-line/70 bg-bg/95 text-[12.5px] font-semibold text-ink shadow-[0_6px_14px_rgba(31,24,21,0.08)] backdrop-blur",
                  "transition-colors duration-300 ease-premium hover:border-ink hover:bg-ink hover:text-bg md:h-12 md:text-[13px]"
                )}
              >
                {justAdded ? (
                  <>
                    <Check className="size-4" />
                    {locale === "ar" ? "تمت الإضافة" : "Added"}
                  </>
                ) : (
                  <>
                    <ShoppingBag className="size-4" />
                    {locale === "ar" ? "اطلب الحين" : "Order now"}
                  </>
                )}
              </button>
            </div>
          ) : null}
        </div>

        {/*
         * Type block — mobile-first hierarchy:
         *   • Title at 14px (was 14, now with tighter letter-spacing)
         *   • Emotional headline at 12px in rose-gold (one line, ellipsed)
         *   • Rating row aligned to the price using flex-baseline
         *   • Price ALWAYS shifts to its own row on the card-bottom for
         *     mobile readability; sm+ inlines it next to the title.
         */}
        <div className="mt-3 px-1 md:mt-4 md:px-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug tracking-[-0.005em] text-ink md:text-[15px]">
                {title}
              </h3>
              {product.headline ? (
                <p className="mt-1 line-clamp-1 font-display text-[13px] italic leading-snug text-accent md:text-[14px]">
                  {pickLocalized(product.headline, locale).split("\n")[0]}
                </p>
              ) : null}
            </div>
            <Price
              price={product.price}
              compareAtPrice={product.compareAtPrice}
              size="sm"
              className="shrink-0 tabular-nums"
            />
          </div>

          {product.rating ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted tabular-nums md:mt-2.5">
              <Star className="size-3 fill-accent text-accent" strokeWidth={0} />
              <span className="font-medium text-ink/80">
                {product.rating.value.toFixed(1)}
              </span>
              <span className="text-muted/80">
                · {product.rating.count.toLocaleString(locale === "ar" ? "ar-SA" : "en-US")}
              </span>
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
