import type { Collection } from "@/lib/types";
import { products } from "./products";

const byCollection = (slug: string) =>
  products.filter((p) => p.collection === slug).map((p) => p.id);

/**
 * Collections at launch — Clinical Skin & Hair Revival.
 *
 * Order is intentional:
 *   1. Face — the core of the brand (Serum + Cream).
 *   2. Hair — the secondary category.
 *   3. Routine — the bundle collection.
 */
export const collections: Collection[] = [
  {
    id: "c_face",
    slug: "face",
    title: { ar: "عناية الوجه", en: "Face Care" },
    productIds: byCollection("face"),
  },
  {
    id: "c_hair",
    slug: "hair",
    title: { ar: "عناية الشعر", en: "Hair Care" },
    productIds: byCollection("hair"),
  },
  {
    id: "c_routine",
    slug: "routine",
    title: { ar: "الروتين المتكامل", en: "The Routine" },
    productIds: products.map((p) => p.id), // All products
  },
];

export function getCollectionBySlug(slug: string): Collection | undefined {
  return collections.find((c) => c.slug === slug);
}
