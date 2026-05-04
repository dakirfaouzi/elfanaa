"use client";

import { FeaturedCollection } from "./FeaturedCollection";
import { useLocale } from "@/hooks/useLocale";
import type { Product } from "@/lib/types";

type Props = {
  products: Product[];
};

/**
 * Locale-aware "you may also like" section for the PDP.
 * Wraps `FeaturedCollection` with copy lifted from the cart dictionary so
 * the same brand voice is used everywhere we suggest cross-products.
 */
export function RelatedProducts({ products }: Props) {
  const { t, locale } = useLocale();
  if (products.length === 0) return null;

  return (
    <FeaturedCollection
      eyebrow={locale === "ar" ? "اكتمل الطقم" : "Complete the look"}
      title={t.cart.youMightAlsoLike}
      href="/shop"
      products={products}
    />
  );
}
