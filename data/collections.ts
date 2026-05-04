import type { Collection } from "@/lib/types";
import { products } from "./products";

const byCollection = (slug: string) =>
  products.filter((p) => p.collection === slug).map((p) => p.id);

/**
 * Collections at launch — one per signature product, plus an "all"
 * landing surface. Keeping the count small keeps the nav calm; a
 * Pottery Barn-redesign finding cited inside `Header.tsx`.
 */
export const collections: Collection[] = [
  {
    id: "c_majlis",
    slug: "majlis",
    title: { ar: "المجلس", en: "Majlis" },
    productIds: byCollection("majlis"),
  },
  {
    id: "c_lighting",
    slug: "lighting",
    title: { ar: "الإنارة", en: "Lighting" },
    productIds: byCollection("lighting"),
  },
  {
    id: "c_decor",
    slug: "decor",
    title: { ar: "الديكور", en: "Decor" },
    productIds: byCollection("decor"),
  },
];

export function getCollectionBySlug(slug: string): Collection | undefined {
  return collections.find((c) => c.slug === slug);
}
