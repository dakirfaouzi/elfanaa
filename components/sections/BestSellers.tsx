"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { ProductCard } from "@/components/product/ProductCard";
import { useLocale } from "@/hooks/useLocale";
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

  return (
    <section className="bg-surface py-16 md:py-24">
      <Container>
        <header className="mb-10 flex items-end justify-between gap-6 md:mb-14">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              {t.home.bestSellersEyebrow}
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
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

        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
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
