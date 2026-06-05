"use client";

import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useLocale } from "@/hooks/useLocale";
import { Container } from "@/components/layout/Container";

/**
 * Repeated in-page CTA anchor (Sprint A #3).
 *
 * The PDP builds a long, image-led story below the buy box but never
 * re-asks for the order — the only CTAs are the top buy box and the sticky
 * bars. This is a lightweight, recurring "ready to order?" anchor placed at
 * conversion-relevant moments in the narrative scroll.
 *
 * It is deliberately PRESENTATION-ONLY: it does NOT add to cart or touch any
 * commerce logic. It smooth-scrolls back to (and focuses) the existing
 * primary buy-box CTA (`[data-pdp-primary-cta]`), where the customer's tier
 * selection lives. Honours `prefers-reduced-motion`.
 */
export function PdpCtaAnchor() {
  const { t } = useLocale();

  const onClick = () => {
    if (typeof document === "undefined") return;
    const target = document.querySelector<HTMLElement>("[data-pdp-primary-cta]");
    if (!target) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "center",
    });
    // Move focus to the real CTA without re-triggering a scroll jump.
    target.focus?.({ preventScroll: true });
  };

  return (
    <div className="py-8 md:py-10">
      <Container>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onClick}
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-full border border-ink/15 bg-bg px-7 text-[14px] font-semibold text-ink shadow-card transition-all duration-300 ease-premium hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:h-[52px] md:text-[15px]"
          >
            <ShoppingBag className="size-4 text-accent" aria-hidden />
            {t.product.orderNow}
            <ArrowLeft
              className="size-4 transition-transform duration-300 ease-premium group-hover:-translate-x-0.5 ltr:rotate-180 rtl:group-hover:translate-x-0.5"
              aria-hidden
            />
          </button>
        </div>
      </Container>
    </div>
  );
}
