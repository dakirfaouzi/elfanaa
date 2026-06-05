import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ShopExperience } from "@/app/shop/ShopExperience";
import { CollectionHero } from "@/components/sections/CollectionHero";
import { collections, getCollectionBySlug } from "@/data/collections";
import { loadAllCatalogProducts } from "@/lib/catalog/loader";
import {
  parseShopFilters,
  parseShopSort,
  type RawSearchParams,
} from "@/lib/shop/url-state";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
};

/*
 * ISR window for collection pages — see `app/page.tsx` for the
 * hybrid-loader rationale. Snapshot-only collections.ts drives the
 * static params and editorial CollectionHero copy; the live catalog
 * loader overlays operator-edited commerce metadata onto the rows.
 */
export const revalidate = 60;

export async function generateStaticParams() {
  return collections.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = getCollectionBySlug(slug);
  if (!collection) return {};
  return {
    title: `${collection.title.ar} | فناء`,
    description: collection.description?.ar ?? collection.tagline?.ar,
    // Canonical to the base path so filter/sort permutations consolidate here.
    alternates: { canonical: `/collections/${collection.slug}` },
  };
}

/**
 * Canonical collection pages — /collections/face, /collections/hair, etc.
 *
 * Distinct from /shop?collection=face in that they carry an editorial
 * CollectionHero, a richer description, and hide the collection chip
 * nav (you're already inside a collection).
 */
export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const collection = getCollectionBySlug(slug);
  if (!collection) notFound();

  const sp = await searchParams;
  const allProducts = await loadAllCatalogProducts();
  // Membership reads the LIVE catalog by bucket so AI-published products
  // appear here (not just the static snapshot productIds). The aggregate
  // "ritual" collection spans the whole catalog.
  const collectionProducts = collection.isAggregate
    ? allProducts
    : allProducts.filter((p) => p.collection === collection.slug);

  return (
    <>
      <CollectionHero
        collection={collection}
        itemCount={collectionProducts.length}
        eyebrow="المجموعة"
        itemsLabel="{count} منتج"
      />
      <ShopExperience
        products={collectionProducts}
        collections={collections}
        collection={collection}
        showCollectionNav={false}
        initialFilters={parseShopFilters(sp)}
        initialSort={parseShopSort(sp)}
      />
    </>
  );
}
