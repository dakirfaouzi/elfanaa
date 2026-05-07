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
    <section className="bg-surface py-16 md:py-24">
      <Container>
        <header
          ref={headerRef as React.RefObject<HTMLElement>}
          className={cn(
            "reveal mb-10 flex items-end justify-between gap-6 md:mb-14",
            headerVisible && "in-view"
          )}
        >
          <div>
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em]">
              <span className="text-accent/60">02</span>
              <span className="h-px w-6 bg-line" aria-hidden />
              <span className="text-accent">{t.home.bestSellersEyebrow}</span>
            </div>
            <h2 className="mt-3 whitespace-pre-line font-display text-4xl font-semibold leading-[1.04] tracking-[-0.02em] md:text-5xl lg:text-[54px]">
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
            "reveal grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-6 md:gap-y-10 lg:grid-cols-4",
            gridVisible && "in-view"
          )}
          style={{ transitionDelay: "100ms" }}
        >
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>

        <div className="mt-10 text-center sm:hidden">
          <Link
            href="/shop"
            className="inline-flex h-12 items-center gap-2 rounded-md bg-ink px-7 text-sm font-medium text-bg transition-colors hover:bg-ink/90"
          >
            {t.home.bestSellersCta}
            <ArrowLeft className="size-4 ltr:rotate-180" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
