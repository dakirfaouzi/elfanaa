"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ShopHeader } from "./ShopHeader";
import { ShopPromo } from "./ShopPromo";
import { ShopToolbar, type ShopSort } from "./ShopToolbar";
import { useLocale } from "@/hooks/useLocale";
import { bestSellerIds } from "@/data/products";
import { productTypeOptions, targetOptions, problemOptions } from "@/data/filters";
import { applyFilters, computeFacetCounts } from "@/lib/shop/filtering";
import { applyShopParams } from "@/lib/shop/url-state";
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
  /** Initial filter state parsed from the URL (server-side) — keeps SSR + load shareable. */
  initialFilters?: FilterState;
  /** Initial sort parsed from the URL (server-side). */
  initialSort?: ShopSort;
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
  initialFilters,
  initialSort,
}: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  // Seed from the URL (parsed server-side) so a shared/bookmarked link
  // restores the same view; subsequent changes are mirrored back to the URL.
  const [sort, setSort] = useState<ShopSort>(initialSort ?? "recommended");
  const [filters, setFilters] = useState<FilterState>(
    initialFilters ?? emptyFilterState
  );

  // Mirror state to the URL on user action only (replace, no scroll jump,
  // preserves unrelated params like ?collection=). Reads the live query
  // from the browser so we don't need a Suspense-bound useSearchParams.
  const syncUrl = useCallback(
    (nextFilters: FilterState, nextSort: ShopSort) => {
      const current =
        typeof window !== "undefined" ? window.location.search : "";
      const params = applyShopParams(
        new URLSearchParams(current),
        nextFilters,
        nextSort
      );
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  const handleFiltersChange = useCallback(
    (next: FilterState) => {
      setFilters(next);
      syncUrl(next, sort);
    },
    [syncUrl, sort]
  );

  const handleSortChange = useCallback(
    (next: ShopSort) => {
      setSort(next);
      syncUrl(filters, next);
    },
    [syncUrl, filters]
  );

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
  const filtered = useMemo(() => applyFilters(products, filters), [products, filters]);

  // Full faceted counts — each option's number reflects the other active dimensions.
  const filterCounts = useMemo(
    () => computeFacetCounts(products, filters, filterOptions),
    [products, filters, filterOptions]
  );

  const sorted = useMemo(() => sortProducts(filtered, sort), [filtered, sort]);

  const hasActiveFilters =
    filters.productTypes.length > 0 ||
    filters.targets.length > 0 ||
    filters.problems.length > 0;

  // Empty-state copy differs by context: a filtered dead-end vs. a
  // collection that simply has no products yet vs. the all-products view.
  const emptyMessage = hasActiveFilters
    ? t.shop.empty
    : collection
      ? t.shop.collectionEmpty
      : t.shop.empty;

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
        onSortChange={handleSortChange}
        filters={filters}
        filterOptions={filterOptions}
        filterCounts={filterCounts}
        onFiltersChange={handleFiltersChange}
        showCollectionNav={showCollectionNav}
      />

      {/* Screen-reader announcement of the live result count after filtering/sorting. */}
      <p role="status" aria-live="polite" className="sr-only">
        {t.shop.itemsLabel.replace("{count}", String(filtered.length))}
      </p>

      <Container>
        {sorted.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-5 py-20 text-center">
            <p className="text-base text-muted">{emptyMessage}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => handleFiltersChange(emptyFilterState)}
                  className="inline-flex h-11 items-center rounded-md border border-line bg-bg px-5 text-sm font-medium text-ink transition-colors hover:bg-brand-soft"
                >
                  {t.shop.filterClearAll}
                </button>
              )}
              <Link
                href="/shop"
                className="inline-flex h-11 items-center rounded-md bg-ink px-5 text-sm font-medium text-bg transition-colors hover:bg-ink/90"
              >
                {t.shop.emptyBrowse}
              </Link>
            </div>
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
