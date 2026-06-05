import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ShopExperience } from "@/app/shop/ShopExperience";
import { CollectionHero } from "@/components/sections/CollectionHero";
import {
  collections,
  genderCollections,
  getGenderCollectionBySlug,
} from "@/data/collections";
import { loadAllCatalogProducts } from "@/lib/catalog/loader";
import {
  parseShopFilters,
  parseShopSort,
  type RawSearchParams,
} from "@/lib/shop/url-state";
import type { ProductTarget } from "@/lib/types";

type Props = {
  params: Promise<{ gender: string }>;
  searchParams: Promise<RawSearchParams>;
};

/*
 * ISR window for gender pages — see `app/page.tsx` for the
 * hybrid-loader rationale. Gender filtering keys off the live
 * `target` field from the catalog row when present, snapshot
 * fallback otherwise.
 */
export const revalidate = 60;

export async function generateStaticParams() {
  return genderCollections.map((c) => ({ gender: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gender } = await params;
  const collection = getGenderCollectionBySlug(gender);
  if (!collection) return {};
  return {
    title: `${collection.title.ar} | فناء`,
    description: collection.description?.ar ?? collection.tagline?.ar,
    alternates: { canonical: `/for/${collection.slug}` },
  };
}

/**
 * Gender-targeted collection pages — /for/women, /for/men.
 *
 * Products are pre-filtered by target (gender or unisex). The filter
 * panel refines further. Collection chip nav is hidden.
 */
export default async function GenderCollectionPage({ params, searchParams }: Props) {
  const { gender } = await params;
  const collection = getGenderCollectionBySlug(gender);
  if (!collection) notFound();

  const sp = await searchParams;
  const allProducts = await loadAllCatalogProducts();
  const target = collection.presetTarget as ProductTarget | undefined;
  const genderProducts = target
    ? allProducts.filter((p) => p.target === target || p.target === "unisex")
    : allProducts.filter((p) => collection.productIds.includes(p.id));

  return (
    <>
      <CollectionHero
        collection={collection}
        itemCount={genderProducts.length}
        eyebrow="تصفح حسب الجنس"
        itemsLabel="{count} منتج"
      />
      <ShopExperience
        products={genderProducts}
        collections={collections}
        collection={collection}
        showCollectionNav={false}
        initialFilters={parseShopFilters(sp)}
        initialSort={parseShopSort(sp)}
      />
    </>
  );
}
