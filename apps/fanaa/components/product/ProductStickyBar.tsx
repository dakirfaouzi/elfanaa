"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useCartHydrated, useCartItemCount } from "@/hooks/useCart";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { useLocale } from "@/hooks/useLocale";
import { lineTotal } from "@/lib/pricing";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/cn";
import { getPrimaryImage } from "@/lib/product-image";
import { SafeProductImage } from "@/components/product/SafeProductImage";
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
 *   • Product-aware on EVERY breakpoint (Sprint A #2): on mobile it is the
 *     PDP's "Order now" bar while the cart is empty, so a mobile shopper who
 *     scrolls past the buy box always has a product-aware add affordance
 *     (the global `<MobileStickyCTA />` only links to /shop on a PDP and is
 *     suppressed there until the cart has items — see MobileStickyCTA).
 *   • Hand-off: once the cart has at least one item, this bar hides on `<md`
 *     and the global `<MobileStickyCTA />` takes over as the checkout bar, so
 *     the two never stack. On `md+` the global bar is hidden, so this bar
 *     always owns the desktop surface.
 *   • Adds via the SAME `onAddToCart` the primary buy-box button uses — no
 *     new cart/checkout logic; `quantity` mirrors the in-page tier selector.
 */
export function ProductStickyBar({
  product,
  quantity,
  onAddToCart,
  triggerSelector = "[data-pdp-primary-cta]",
}: Props) {
  const { locale, t } = useLocale();
  const format = useFormatPrice();
  const itemCount = useCartItemCount();
  const hydrated = useCartHydrated();
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
  const image = getPrimaryImage(product);

  // Hand-off to the global MobileStickyCTA: once the cart has items, hide this
  // bar below md so the global checkout bar can own the mobile surface. Desktop
  // (md+) is unaffected — the global bar is md:hidden there.
  const hideBelowMd = hydrated && itemCount > 0;

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-30 block border-t border-line bg-bg/95 shadow-elevated backdrop-blur-md",
        "transition-all duration-300 ease-premium",
        visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
        hideBelowMd && "max-md:hidden",
        "[padding-bottom:env(safe-area-inset-bottom)]"
      )}
    >
      <div className="pointer-events-auto mx-auto flex max-w-content items-center gap-3 px-4 py-3 md:gap-4 md:px-6">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-sm bg-brand-soft">
          <SafeProductImage
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
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-ink px-5 text-sm font-medium text-bg shadow-card transition-colors hover:bg-ink/90 md:px-6"
        >
          <ShoppingBag className="size-4" />
          {t.product.orderNow}
          <ArrowLeft className="size-4 ltr:rotate-180" />
        </button>
      </div>
    </div>
  );
}
