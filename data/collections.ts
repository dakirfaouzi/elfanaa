import type { Collection } from "@/lib/types";
import { products } from "./products";

const byCollection = (slug: string) =>
  products.filter((p) => p.collection === slug).map((p) => p.id);

/**
 * Collections at launch — Health & Beauty edition.
 *
 * Three categories, one per signature product. Each slug matches the
 * `collection` field in `data/products.ts` so nav links filter to a
 * non-empty result.
 *
 * Order is intentional:
 *   1. Skincare  — broadest appeal, unisex, the hero category.
 *   2. Haircare  — second-most-trafficked H&B category in KSA.
 *   3. Grooming  — narrower (men's), placed last to anchor the men's path.
 */
export const collections: Collection[] = [
  {
    id: "c_skincare",
    slug: "skincare",
    title: { ar: "العناية بالبشرة", en: "Skincare" },
    productIds: byCollection("skincare"),
  },
  {
    id: "c_haircare",
    slug: "haircare",
    title: { ar: "العناية بالشعر", en: "Haircare" },
    productIds: byCollection("haircare"),
  },
  {
    id: "c_grooming",
    slug: "grooming",
    title: { ar: "العناية الرجالية", en: "Men's grooming" },
    productIds: byCollection("grooming"),
  },
];

export function getCollectionBySlug(slug: string): Collection | undefined {
  return collections.find((c) => c.slug === slug);
}
