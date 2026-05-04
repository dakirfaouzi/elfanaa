"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { ProductGrid } from "@/components/product/ProductGrid";
import { useLocale } from "@/hooks/useLocale";
import type { Product } from "@/lib/types";

type FeaturedCollectionProps = {
  eyebrow?: string;
  title: string;
  href: string;
  products: Product[];
};

export function FeaturedCollection({ eyebrow, title, href, products }: FeaturedCollectionProps) {
  const { locale } = useLocale();
  return (
    <section className="py-16 md:py-24">
      <Container>
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            {eyebrow ? (
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                {eyebrow}
              </p>
            ) : null}
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              {title}
            </h2>
          </div>
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/80 transition-colors hover:text-ink"
          >
            {locale === "ar" ? "عرض الكل" : "View all"}
            <ArrowRight className="size-4 rtl:rotate-180" />
          </Link>
        </div>

        <ProductGrid products={products} />
      </Container>
    </section>
  );
}
