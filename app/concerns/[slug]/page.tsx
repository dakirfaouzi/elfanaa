import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ShopExperience } from "@/app/shop/ShopExperience";
import { CollectionHero } from "@/components/sections/CollectionHero";
import { collections, concernCollections, getConcernBySlug } from "@/data/collections";
import { products } from "@/data/products";
import type { ProductProblem } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return concernCollections.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const concern = getConcernBySlug(slug);
  if (!concern) return {};
  return {
    title: `${concern.title.ar} | فناء`,
    description: concern.description?.ar ?? concern.tagline?.ar,
  };
}

/**
 * Problem-solving collection pages — /concerns/dark-spots, /concerns/dryness, etc.
 *
 * Products are pre-filtered by the concern's `presetProblems`. The filter
 * panel is still available for further refinement. Collection chip nav is
 * hidden — the concern provides the browsing context.
 */
export default async function ConcernPage({ params }: Props) {
  const { slug } = await params;
  const concern = getConcernBySlug(slug);
  if (!concern) notFound();

  const concernProducts =
    concern.presetProblems && concern.presetProblems.length > 0
      ? products.filter((p) =>
          p.problems?.some((pr) =>
            concern.presetProblems!.includes(pr as ProductProblem)
          )
        )
      : products.filter((p) => concern.productIds.includes(p.id));

  return (
    <>
      <CollectionHero
        collection={concern}
        itemCount={concernProducts.length}
        eyebrow="اكتشف حسب المشكلة"
        itemsLabel="{count} منتج"
      />
      <ShopExperience
        products={concernProducts}
        collections={collections}
        collection={concern}
        showCollectionNav={false}
      />
    </>
  );
}
