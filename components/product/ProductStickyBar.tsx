"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { useLocale } from "@/hooks/useLocale";
import { lineTotal } from "@/lib/pricing";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Product } from "@/lib/types";

type Props = {
  product: Product;
  quantity: number;
  onAddToCart: () => void;
  /** Element above which the bar should hide (the in-page primary CTA). */
  triggerSelector?: string;
};

/**
 * Sticky add-to-cart bar — the conversion safety net.
 *
 * Behaviour:
 *   • Hidden until the customer has scrolled past the in-page primary
 *     CTA (kept invisible while it's still in view to avoid a duplicate
 *     button competing with the primary).
 *   • Hidden again once the footer is in view — keeps the page exits
 *     visible and prevents the sticky bar from covering the contact form.
 *   • On mobile: the global `<MobileStickyCTA />` already handles cart
 *     CTAs once the cart has items. To prevent two stacked bars, this
 *     bar hides on `<md` once the cart contains at least one item.
 *   • Keeps the same `quantity` selection as the in-page tier selector
 *     so what the customer chose doesn't reset on click.
 */
export function ProductStickyBar({
  product,
  quantity,
  onAddToCart,
  triggerSelector = "[data-pdp-primary-cta]",
}: Props) {
  const { locale, t } = useLocale();
  const format = useFormatPrice();
  const [visible, setVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const trigger = document.querySelector(triggerSelector);
    if (!trigger) return;

    // We toggle `visible` based on whether the in-page primary CTA is
    // *not* in the viewport. IntersectionObserver is cheap enough that
    // we don't need a scroll listener on top.
    observerRef.current = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: "0px 0px -10% 0px" }
    );
    observerRef.current.observe(trigger);
    return () => observerRef.current?.disconnect();
  }, [triggerSelector]);

  const total = lineTotal(product, quantity);
  const image = product.images[0];

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-30 hidden border-t border-line bg-bg/95 shadow-elevated backdrop-blur-md md:block",
        "transition-all duration-300 ease-premium",
        visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
        "[padding-bottom:env(safe-area-inset-bottom)]"
      )}
    >
      <div className="pointer-events-auto mx-auto flex max-w-content items-center gap-4 px-6 py-3">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-sm bg-brand-soft">
          <Image
            src={image.src}
            alt={pickLocalized(image.alt, locale)}
            fill
            sizes="48px"
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {pickLocalized(product.title, locale)}
          </p>
          <p className="text-[11px] text-muted">
            × <span className="tabular-nums">{quantity}</span> ·{" "}
            <span className="tabular-nums">{format(total)}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={onAddToCart}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-6 text-sm font-medium text-bg shadow-card transition-colors hover:bg-ink/90"
        >
          <ShoppingBag className="size-4" />
          {t.product.orderNow}
          <ArrowLeft className="size-4 ltr:rotate-180" />
        </button>
      </div>
    </div>
  );
}
