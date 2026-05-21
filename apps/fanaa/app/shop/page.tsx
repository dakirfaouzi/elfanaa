import { ShopExperience } from "./ShopExperience";
import { products } from "@/data/products";
import { collections, getCollectionBySlug } from "@/data/collections";

type ShopPageProps = {
  searchParams: Promise<{ collection?: string }>;
};

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
  const filtered = collection
    ? products.filter((p) => p.collection === collection)
    : products;
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
