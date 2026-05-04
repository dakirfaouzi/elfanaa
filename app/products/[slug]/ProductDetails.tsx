"use client";

import { useState } from "react";
import { ArrowLeft, Check, ShoppingBag } from "lucide-react";
import { OfferSelector } from "@/components/product/OfferSelector";
import { ScarcitySignals } from "@/components/product/ScarcitySignals";
import { PDPTrustRow } from "@/components/product/PDPTrustRow";
import { ProductStickyBar } from "@/components/product/ProductStickyBar";
import { RatingStars } from "@/components/ui/RatingStars";
import { Badge } from "@/components/ui/Badge";
import { useCart } from "@/hooks/useCart";
import { useUI } from "@/hooks/useUI";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Product } from "@/lib/types";

type Props = { product: Product };

/**
 * PDP details panel — sits opposite the gallery, drives the conversion.
 *
 * Composition (top-down, intentional CRO order):
 *   1. Badges        — fast trust + scarcity tag
 *   2. Headline      — the *emotional* H1 (overrides product title)
 *   3. Rating row    — quantitative social proof, anchored in the gallery
 *   4. Subheadline   — calmer, factual paragraph
 *   5. Scarcity      — "X left" + "Y bought today"
 *   6. OfferSelector — the conversion centerpiece (1 / 2 / 3)
 *   7. CTA           — "اطلب الآن" → adds N → opens drawer
 *   8. Trust row     — micro-trust under the button
 *
 * The H1 prefers `product.headline` and falls back to the title.
 * The gallery is rendered *outside* this component so the page can
 * stack mobile gallery → details correctly.
 */
export function ProductDetails({ product }: Props) {
  const { locale, t } = useLocale();
  const add = useCart((s) => s.add);
  const openCart = useUI((s) => s.openCart);
  const [selected, setSelected] = useState<number>(initialQty(product));
  const [feedback, setFeedback] = useState<"idle" | "added">("idle");

  const headline = product.headline ?? product.title;
  const subhead = product.subheadline;

  const onAddToCart = () => {
    add(product.id, selected);
    setFeedback("added");
    setTimeout(openCart, 220);
    setTimeout(() => setFeedback("idle"), 1600);
  };

  return (
    <div className="flex flex-col gap-6">
      {product.badges?.length ? (
        <div className="flex flex-wrap gap-2">
          {product.badges.map((b, i) => (
            <Badge key={i}>{pickLocalized(b, locale)}</Badge>
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        <h1 className="whitespace-pre-line font-display text-3xl font-semibold leading-[1.15] tracking-tight text-ink md:text-4xl lg:text-[44px]">
          {pickLocalized(headline, locale)}
        </h1>
        {product.rating ? (
          <RatingStars
            value={product.rating.value}
            count={product.rating.count}
            label={t.product.reviews}
            size="md"
          />
        ) : null}
        {subhead ? (
          <p className="max-w-prose text-base leading-relaxed text-muted">
            {pickLocalized(subhead, locale)}
          </p>
        ) : (
          <p className="max-w-prose text-base leading-relaxed text-muted">
            {pickLocalized(product.description, locale)}
          </p>
        )}
      </div>

      <ScarcitySignals product={product} />

      <OfferSelector
        product={product}
        selected={selected}
        onSelect={setSelected}
      />

      <button
        type="button"
        data-pdp-primary-cta
        onClick={onAddToCart}
        className={cn(
          "group relative inline-flex h-14 w-full items-center justify-center gap-2 rounded-md text-base font-semibold transition-all duration-200 ease-premium",
          "shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30",
          feedback === "added"
            ? "bg-success text-bg"
            : "bg-ink text-bg hover:-translate-y-px hover:shadow-elevated active:translate-y-0"
        )}
      >
        {feedback === "added" ? (
          <>
            <Check className="size-5" aria-hidden />
            {t.product.added}
          </>
        ) : (
          <>
            <ShoppingBag className="size-5" aria-hidden />
            {t.product.orderNow}
            <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
          </>
        )}
      </button>

      <p className="-mt-2 text-center text-[12px] text-muted">
        {t.product.cod} · {t.product.delivery} · {t.product.returns}
      </p>

      <PDPTrustRow />

      {/* Sticky bar — desktop only; mobile uses the global MobileStickyCTA */}
      <ProductStickyBar
        product={product}
        quantity={selected}
        onAddToCart={onAddToCart}
      />
    </div>
  );
}

/** Default tier picked on PDP load — favours the middle (anchor effect). */
function initialQty(product: Product): number {
  const tiers = product.offerTiers;
  if (!tiers || tiers.length === 0) return 1;
  const sorted = [...tiers].sort((a, b) => a.quantity - b.quantity);
  return sorted[Math.floor(sorted.length / 2)]?.quantity ?? 1;
}
