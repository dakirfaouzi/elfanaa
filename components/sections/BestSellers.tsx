"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { ProductCard } from "@/components/product/ProductCard";
import { useLocale } from "@/hooks/useLocale";
import { useInView } from "@/hooks/useInView";
import { cn } from "@/lib/cn";
import type { Product } from "@/lib/types";

type BestSellersProps = {
  products: Product[];
};

/**
 * Best sellers grid — 2-up mobile, 4-up desktop. Lifestyle imagery + price + quick add
 * are baked into ProductCard, so this section stays minimal and stylable.
 */
export function BestSellers({ products }: BestSellersProps) {
  const { t, locale } = useLocale();
  const { ref: headerRef, inView: headerVisible } = useInView();
  const { ref: gridRef, inView: gridVisible } = useInView({ rootMargin: "0px 0px -60px 0px" });

  return (
    <section className="fn-section-y bg-surface">
      <Container>
        <header
          ref={headerRef as React.RefObject<HTMLElement>}
          className={cn(
            "reveal mb-10 flex items-end justify-between gap-6 md:mb-14",
            headerVisible && "in-view"
          )}
        >
          <div>
            <p className="fn-eyebrow-step">
              <span className="fn-step-num">02</span>
              <span className="fn-step-rule" />
              <span>{t.home.bestSellersEyebrow}</span>
            </p>
            <h2 className="fn-section-title mt-4 md:mt-5">
              {t.home.bestSellersTitle}
            </h2>
          </div>
          <Link
            href="/shop"
            className="hidden items-center gap-1.5 text-sm font-medium text-ink/80 transition-colors hover:text-ink sm:inline-flex"
          >
            {t.home.bestSellersCta}
            <ArrowLeft className="size-4 ltr:rotate-180" />
          </Link>
        </header>

        <div
          ref={gridRef as React.RefObject<HTMLDivElement>}
          className={cn(
            "reveal grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-5 md:grid-cols-3 md:gap-x-6 md:gap-y-12 lg:grid-cols-4",
            gridVisible && "in-view"
          )}
          style={{ transitionDelay: "100ms" }}
        >
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>

        <div className="mt-12 text-center sm:hidden">
          <Link
            href="/shop"
            className="btn-press fn-cta-glow inline-flex h-[54px] items-center gap-2.5 rounded-full bg-ink px-8 text-[15px] font-semibold text-bg shadow-[0_14px_36px_rgba(31,24,21,0.18)]"
          >
            {t.home.bestSellersCta}
            <ArrowLeft className="size-4 ltr:rotate-180" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
