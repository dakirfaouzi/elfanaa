"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useCart, useCartHydrated } from "@/hooks/useCart";
import { useUI } from "@/hooks/useUI";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/cn";

type MobileStickyCTAProps = {
  /** Where the idle CTA points when the cart is empty. */
  href?: string;
  /** Show only after the user has scrolled this many px (avoids overlapping the hero). */
  showAfter?: number;
};

/**
 * Mobile-only persistent CTA bar.
 *
 * Behaviour (Baymard / Kaspian: +8–12% mobile add-to-cart lift):
 *   • Hidden until the user scrolls past `showAfter` (keeps hero clean).
 *   • Empty cart → CTA links to /shop with the headline action ("اطلب الآن").
 *   • Cart with items → CTA opens the checkout modal and shows live total.
 *   • Hidden on desktop (`md:hidden`) — desktop has the header CTA.
 *   • Always sits above the iOS safe-area inset.
 */
export function MobileStickyCTA({ href = "/shop", showAfter = 480 }: MobileStickyCTAProps) {
  const { t } = useLocale();
  const itemCount = useCart((s) => s.itemCount());
  const subtotal = useCart((s) => s.subtotal());
  const hydrated = useCartHydrated();
  const openCheckout = useUI((s) => s.openCheckout);
  const cartOpen = useUI((s) => s.cartOpen);
  const checkoutOpen = useUI((s) => s.checkoutOpen);
  const format = useFormatPrice();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > showAfter);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showAfter]);

  const hasItems = hydrated && itemCount > 0;
  const hidden = cartOpen || checkoutOpen || !visible;

  return (
    <div
      aria-hidden={hidden || undefined}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-3 md:hidden",
        "transition-all duration-300 ease-premium",
        hidden ? "translate-y-full opacity-0" : "translate-y-0 opacity-100",
        // Respect iOS safe-area without breaking on Android
        "[padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]"
      )}
    >
      {hasItems ? (
        <button
          type="button"
          onClick={openCheckout}
          className="pointer-events-auto flex h-[52px] w-full items-center justify-between gap-3 rounded-md bg-ink px-5 text-bg shadow-elevated active:scale-[0.99]"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <ShoppingBag className="size-4" />
            {t.sticky.ctaCart}
          </span>
          <span className="inline-flex items-center gap-2 text-sm font-semibold tabular-nums">
            {format(subtotal)}
            <ArrowLeft className="size-4 ltr:rotate-180" />
          </span>
        </button>
      ) : (
        <Link
          href={href}
          className="pointer-events-auto flex h-[52px] w-full items-center justify-center gap-2 rounded-md bg-ink text-sm font-medium text-bg shadow-elevated active:scale-[0.99]"
        >
          {t.sticky.ctaIdle}
          <ArrowLeft className="size-4 ltr:rotate-180" />
        </Link>
      )}
    </div>
  );
}
