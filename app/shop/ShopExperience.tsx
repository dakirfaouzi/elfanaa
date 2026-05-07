"use client";

import { useMemo, useState } from "react";
import { Container } from "@/components/layout/Container";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ShopHeader } from "./ShopHeader";
import { ShopPromo } from "./ShopPromo";
import { ShopToolbar, type ShopSort } from "./ShopToolbar";
import { useLocale } from "@/hooks/useLocale";
import { bestSellerIds } from "@/data/products";
import { productTypeOptions, targetOptions, problemOptions } from "@/data/filters";
import type {
  Collection,
  FilterOptions,
  FilterState,
  Product,
  ProductProblem,
} from "@/lib/types";
import { emptyFilterState } from "@/lib/types";

type Props = {
  /** All products (server-passed, already filtered by collection if needed). */
  products: Product[];
  /** Available top-level collections for the chip nav. */
  collections: Collection[];
  /** Selected collection meta — undefined for the all-products view. */
  collection?: Collection;
  /** Active collection slug — used to drive the chip nav state. */
  activeSlug?: string;
  /**
   * When false the collection chip nav is hidden.
   * Set to false on dedicated collection / concern / gender pages.
   */
  showCollectionNav?: boolean;
};

/**
 * Client-side shop experience.
 *
 * Server hands us a stable, server-filtered product list. We layer two
 * cheap client behaviours on top:
 *
 *   • Sort — toggled in the toolbar; default is "Recommended" which
 *     respects the editorial best-seller order from the data layer.
 *   • Live count — surfaced in the editorial header so the customer
 *     sees the catalog "fill" as they filter.
 *
 * No fetch, no skeletons — the catalog is small enough (3 SKUs at
 * launch, dozens at scale) that a single sort is instantaneous.
 */
export function ShopExperience({
  products,
  collections,
  collection,
  activeSlug,
  showCollectionNav = true,
}: Props) {
  const { t } = useLocale();
  const [sort, setSort] = useState<ShopSort>("recommended");
  const [filters, setFilters] = useState<FilterState>(emptyFilterState);

  // Derive which filter options actually exist in this collection view.
  // Only show options with at least one matching product — avoids dead-end filters.
  const filterOptions = useMemo((): FilterOptions => {
    const types = new Set(products.map((p) => p.productType).filter(Boolean));
    const targets = new Set(products.map((p) => p.target).filter(Boolean));
    const problems = new Set(products.flatMap((p) => p.problems ?? []));
    return {
      productTypes: productTypeOptions.filter((o) => types.has(o.value as Product["productType"])),
      targets: targetOptions.filter((o) => targets.has(o.value as Product["target"])),
      problems: problemOptions.filter((o) => problems.has(o.value as ProductProblem)),
    };
  }, [products]);

  // Apply facet filters client-side — instantaneous at catalog size.
  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (
        filters.productTypes.length > 0 &&
        (!p.productType || !filters.productTypes.includes(p.productType))
      )
        return false;
      if (
        filters.targets.length > 0 &&
        (!p.target || !filters.targets.includes(p.target))
      )
        return false;
      if (
        filters.problems.length > 0 &&
        !filters.problems.some((f) => p.problems?.includes(f as ProductProblem))
      )
        return false;
      return true;
    });
  }, [products, filters]);

  const sorted = useMemo(() => sortProducts(filtered, sort), [filtered, sort]);

  return (
    <>
      <ShopPromo />
      {/*
       * Hide ShopHeader on dedicated collection / concern / gender pages.
       * Those pages already render a full CollectionHero — showing
       * ShopHeader as well doubles the heading hierarchy and adds ~200px
       * of dead space between the hero and the product grid.
       */}
      {showCollectionNav && (
        <ShopHeader collection={collection} itemCount={filtered.length} />
      )}
      <ShopToolbar
        collections={collections}
        active={activeSlug}
        sort={sort}
        onSortChange={setSort}
        filters={filters}
        filterOptions={filterOptions}
        onFiltersChange={setFilters}
        showCollectionNav={showCollectionNav}
      />

      <Container>
        {sorted.length === 0 ? (
          <div className="flex min-h-[40vh] items-center justify-center py-20 text-center">
            <p className="text-base text-muted">{t.shop.empty}</p>
          </div>
        ) : (
          <div className="py-8 md:py-12">
            <ProductGrid products={sorted} />
          </div>
        )}
      </Container>
    </>
  );
}

/**
 * Pure sort function — kept outside the component so it stays trivially
 * unit-testable and never re-allocates closures on every render.
 */
function sortProducts(products: Product[], sort: ShopSort): Product[] {
  const list = [...products];
  switch (sort) {
    case "price-asc":
      return list.sort((a, b) => a.price.amount - b.price.amount);
    case "price-desc":
      return list.sort((a, b) => b.price.amount - a.price.amount);
    case "best": {
      // Bestsellers first, then everything else by rating count.
      const order = new Map<string, number>(
        bestSellerIds.map((id, idx) => [id, idx])
      );
      return list.sort((a, b) => {
        const ai = order.get(a.id);
        const bi = order.get(b.id);
        if (ai !== undefined && bi !== undefined) return ai - bi;
        if (ai !== undefined) return -1;
        if (bi !== undefined) return 1;
        return (b.rating?.count ?? 0) - (a.rating?.count ?? 0);
      });
    }
    case "recommended":
    default:
      // Default editorial order — the data layer's array order wins.
      return list;
  }
}
