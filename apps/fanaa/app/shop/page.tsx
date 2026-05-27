import { ShopExperience } from "./ShopExperience";
import { loadAllCatalogProducts } from "@/lib/catalog/loader";
import { collections, getCollectionBySlug } from "@/data/collections";

type ShopPageProps = {
  searchParams: Promise<{ collection?: string }>;
};

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
  const { collection } = await searchParams;
  const allProducts = await loadAllCatalogProducts();
  const filtered = collection
    ? allProducts.filter((p) => p.collection === collection)
    : allProducts;
  const collectionMeta = collection ? getCollectionBySlug(collection) : undefined;

  return (
    <ShopExperience
      products={filtered}
      collections={collections}
      collection={collectionMeta}
      activeSlug={collection}
    />
  );
}
