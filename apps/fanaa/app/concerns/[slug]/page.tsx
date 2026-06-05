import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ShopExperience } from "@/app/shop/ShopExperience";
import { CollectionHero } from "@/components/sections/CollectionHero";
import { collections, concernCollections, getConcernBySlug } from "@/data/collections";
import { loadAllCatalogProducts } from "@/lib/catalog/loader";
import {
  parseShopFilters,
  parseShopSort,
  type RawSearchParams,
} from "@/lib/shop/url-state";
import type { ProductProblem } from "@/lib/types";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
};

/*
 * ISR window for concern pages. Concern filtering keys off the live
 * `problems` array from the hybrid catalog loader (M12 / Step 2), so
 * an operator clearing a problem tag in Studio surfaces here within
 * ~60s without a redeploy.
 */
export const revalidate = 60;

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
    alternates: { canonical: `/concerns/${concern.slug}` },
  };
}

/**
 * Problem-solving collection pages — /concerns/dark-spots, /concerns/dryness, etc.
 *
 * Products are pre-filtered by the concern's `presetProblems`. The filter
 * panel is still available for further refinement. Collection chip nav is
 * hidden — the concern provides the browsing context.
 */
export default async function ConcernPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const concern = getConcernBySlug(slug);
  if (!concern) notFound();

  const sp = await searchParams;
  const allProducts = await loadAllCatalogProducts();
  const concernProducts =
    concern.presetProblems && concern.presetProblems.length > 0
      ? allProducts.filter((p) =>
          p.problems?.some((pr) =>
            concern.presetProblems!.includes(pr as ProductProblem)
          )
        )
      : allProducts.filter((p) => concern.productIds.includes(p.id));

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
        initialFilters={parseShopFilters(sp)}
        initialSort={parseShopSort(sp)}
      />
    </>
  );
}
