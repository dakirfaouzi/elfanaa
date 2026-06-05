"use client";

import { useState } from "react";
import { ArrowLeft, BadgeCheck, Check, ShieldCheck, ShoppingBag } from "lucide-react";
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

  // Trust density near the CTA (Sprint B #4) — both signals are REAL data,
  // gated on presence (never fabricated):
  //   • the AI-grounded guarantee promise (sectionContent.guarantee.title),
  //     surfaced at the decision point instead of only far down the page;
  //   • the count of reviews actually flagged `verified` (omitted when zero).
  const guaranteePromise = product.sectionContent?.guarantee?.title;
  const verifiedBuyers = (product.reviews ?? []).filter((r) => r.verified).length;

  const onAddToCart = () => {
    // Pass the full Product so AI-generated SKUs (absent from the
    // snapshot) can still be added — Phase 2.5 "bridge the catalog
    // split". The PDP server-loaded this product via the hybrid
    // loader; passing it here is the path that closes the loop
    // through useCart → cart drawer → checkout.
    add(product.id, selected, { product });
    setFeedback("added");
    setTimeout(openCart, 220);
    setTimeout(() => setFeedback("idle"), 1600);
  };

  return (
    <div className="flex flex-col gap-6 md:gap-7">
      {product.badges?.length ? (
        <div className="flex flex-wrap gap-2">
          {product.badges.map((b, i) => (
            <Badge key={i}>{pickLocalized(b, locale)}</Badge>
          ))}
        </div>
      ) : null}

      <div className="space-y-4">
        <h1 className="whitespace-pre-line font-display text-[32px] font-semibold leading-[1.08] tracking-[-0.015em] text-ink md:text-4xl lg:text-[46px]">
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
          <p className="max-w-prose text-[15px] leading-[1.8] text-muted md:text-[17px]">
            {pickLocalized(subhead, locale)}
          </p>
        ) : (
          <p className="max-w-prose text-[15px] leading-[1.8] text-muted md:text-[17px]">
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
          "group fn-cta-glow relative inline-flex h-[56px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-all duration-300 ease-premium md:h-[58px] md:text-base",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          feedback === "added"
            ? "bg-success text-bg"
            : "bg-ink text-bg hover:-translate-y-0.5 active:translate-y-0"
        )}
        style={{
          boxShadow:
            feedback === "added"
              ? undefined
              : "0 16px 40px rgba(31,24,21,0.18), 0 0 0 1px rgba(199,162,124,0.30)",
        }}
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
            <ArrowLeft className="size-4 transition-transform duration-300 ease-premium group-hover:-translate-x-0.5 ltr:rotate-180 rtl:group-hover:translate-x-0.5" aria-hidden />
          </>
        )}
      </button>

      <p className="-mt-2 text-center text-[12.5px] leading-relaxed text-muted">
        {t.product.cod} · {t.product.delivery} · {t.product.returns}
      </p>

      {guaranteePromise || verifiedBuyers > 0 ? (
        <div className="-mt-1 flex flex-col items-center gap-2">
          {guaranteePromise ? (
            <p className="flex items-center justify-center gap-2 text-center text-[12.5px] font-medium text-ink/80">
              <ShieldCheck
                className="size-4 shrink-0 text-accent"
                strokeWidth={1.5}
                aria-hidden
              />
              <span>{pickLocalized(guaranteePromise, locale)}</span>
            </p>
          ) : null}
          {verifiedBuyers > 0 ? (
            <p className="flex items-center justify-center gap-1.5 text-center text-[12px] text-muted">
              <BadgeCheck className="size-3.5 shrink-0 text-success" aria-hidden />
              <span>
                {t.product.ctaVerifiedBuyers.replace(
                  "{count}",
                  String(verifiedBuyers)
                )}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

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
