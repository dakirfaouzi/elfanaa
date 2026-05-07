import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ShopExperience } from "@/app/shop/ShopExperience";
import { CollectionHero } from "@/components/sections/CollectionHero";
import { collections, getCollectionBySlug } from "@/data/collections";
import { products } from "@/data/products";

type Props = { params: Promise<{ slug: string }> };

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
  };
}

/**
 * Canonical collection pages — /collections/face, /collections/hair, etc.
 *
 * Distinct from /shop?collection=face in that they carry an editorial
 * CollectionHero, a richer description, and hide the collection chip
 * nav (you're already inside a collection).
 */
export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const collection = getCollectionBySlug(slug);
  if (!collection) notFound();

  const collectionProducts = products.filter((p) =>
    collection.productIds.includes(p.id)
  );

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
      />
    </>
  );
}
