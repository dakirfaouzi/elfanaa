import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ShopExperience } from "@/app/shop/ShopExperience";
import { CollectionHero } from "@/components/sections/CollectionHero";
import {
  collections,
  genderCollections,
  getGenderCollectionBySlug,
} from "@/data/collections";
import { products } from "@/data/products";
import type { ProductTarget } from "@/lib/types";

type Props = { params: Promise<{ gender: string }> };

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
  };
}

/**
 * Gender-targeted collection pages — /for/women, /for/men.
 *
 * Products are pre-filtered by target (gender or unisex). The filter
 * panel refines further. Collection chip nav is hidden.
 */
export default async function GenderCollectionPage({ params }: Props) {
  const { gender } = await params;
  const collection = getGenderCollectionBySlug(gender);
  if (!collection) notFound();

  const target = collection.presetTarget as ProductTarget | undefined;
  const genderProducts = target
    ? products.filter((p) => p.target === target || p.target === "unisex")
    : products.filter((p) => collection.productIds.includes(p.id));

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
      />
    </>
  );
}
