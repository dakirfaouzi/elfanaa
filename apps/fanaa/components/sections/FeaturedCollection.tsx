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
    <section className="fn-section-y">
      <Container>
        <div className="mb-10 flex items-end justify-between gap-6 md:mb-12">
          <div>
            {eyebrow ? (
              <p className="fn-eyebrow mb-3">
                <span className="fn-rule" />
                <span>{eyebrow}</span>
              </p>
            ) : null}
            <h2 className="fn-section-title">
              {title}
            </h2>
          </div>
          <Link
            href={href}
            className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-ink/80 transition-colors hover:text-ink sm:inline-flex"
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
