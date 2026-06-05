import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { ShopExperience } from "./ShopExperience";
import { loadAllCatalogProducts } from "@/lib/catalog/loader";
import { collections, getCollectionBySlug } from "@/data/collections";
import { pageMetadata } from "@/lib/seo";
import {
  applyShopParams,
  parseShopFilters,
  parseShopSort,
  type RawSearchParams,
} from "@/lib/shop/url-state";

type ShopPageProps = {
  searchParams: Promise<RawSearchParams>;
};

/*
 * Canonical never points at a redirecting URL: a known `?collection=`
 * canonicalizes to the editorial `/collections/<slug>` it 308s to;
 * everything else consolidates filter/sort permutations onto `/shop`.
 */
export async function generateMetadata({
  searchParams,
}: ShopPageProps): Promise<Metadata> {
  const params = await searchParams;
  const collection =
    typeof params.collection === "string" ? params.collection : undefined;
  const meta = collection ? getCollectionBySlug(collection) : undefined;
  return pageMetadata({
    path: meta ? `/collections/${meta.slug}` : "/shop",
    title: meta ? meta.title.ar : undefined,
    description: meta?.description?.ar ?? meta?.tagline?.ar,
  });
}

/*
 * ISR window for the shop list. See `app/page.tsx` for the rationale —
 * the hybrid catalog loader (M12 / Step 2) gives operators a ~60s
 * propagation window for commerce edits, and degrades to the snapshot
 * if the DB is unreachable.
 */
export const revalidate = 60;

/**
 * Shop / collection page.
 *
 * Server-renders a stable list (filtered by `collection` query) and
 * hands it to the client component for sort + interactivity. Keeping
 * the filter on the server preserves SEO + clean URLs (`?collection=majlis`
 * deep-links cleanly).
 */
export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const collection =
    typeof params.collection === "string" ? params.collection : undefined;
  const collectionMeta = collection ? getCollectionBySlug(collection) : undefined;

  // Canonicalize: 308 from /shop?collection=<known main slug> to the
  // editorial /collections/<slug>, preserving validated filter/sort params.
  if (collectionMeta) {
    const qs = applyShopParams(
      new URLSearchParams(),
      parseShopFilters(params),
      parseShopSort(params)
    ).toString();
    permanentRedirect(`/collections/${collectionMeta.slug}${qs ? `?${qs}` : ""}`);
  }

  const allProducts = await loadAllCatalogProducts();
  // Only unknown collection slugs reach here (known ones redirected above).
  const filtered = collection
    ? allProducts.filter((p) => p.collection === collection)
    : allProducts;

  return (
    <ShopExperience
      products={filtered}
      collections={collections}
      activeSlug={collection}
      initialFilters={parseShopFilters(params)}
      initialSort={parseShopSort(params)}
    />
  );
}
