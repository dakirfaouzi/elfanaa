/**
 * Pure shop-filtering helpers.
 *
 * Kept free of React/I/O so the matching logic is shared by the live
 * grid filter *and* the faceted counts, and is trivially unit-testable.
 * The shop is small enough that recomputing on every render is free.
 */
import type {
  FilterCounts,
  FilterOptions,
  FilterState,
  Product,
  ProductProblem,
} from "@/lib/types";

/** The three active filter dimensions, in display order. */
export const FILTER_DIMENSIONS = [
  "productTypes",
  "targets",
  "problems",
] as const satisfies readonly (keyof FilterState)[];

export type FilterDimension = (typeof FILTER_DIMENSIONS)[number];

/**
 * Does a product satisfy a single dimension given the selected values?
 *
 * An empty selection matches everything (the dimension is inactive).
 * Within a dimension the match is an OR across selected values.
 */
export function matchesDimension(
  product: Product,
  dimension: FilterDimension,
  values: readonly string[],
): boolean {
  if (values.length === 0) return true;
  switch (dimension) {
    case "productTypes":
      return !!product.productType && values.includes(product.productType);
    case "targets":
      return !!product.target && values.includes(product.target);
    case "problems":
      return (
        !!product.problems &&
        values.some((v) => product.problems!.includes(v as ProductProblem))
      );
    default:
      return true;
  }
}

/** Apply the full filter state (AND across dimensions). */
export function applyFilters(
  products: Product[],
  filters: FilterState,
): Product[] {
  return products.filter((p) =>
    FILTER_DIMENSIONS.every((dim) => matchesDimension(p, dim, filters[dim])),
  );
}

/**
 * Full faceted counts.
 *
 * For each option in a dimension, count the products that match every
 * *other* active dimension AND that option — so the number reflects what
 * the customer would actually see if they added that one filter.
 */
export function computeFacetCounts(
  products: Product[],
  filters: FilterState,
  options: FilterOptions,
): FilterCounts {
  const counts: FilterCounts = {
    productTypes: {},
    targets: {},
    problems: {},
  };

  for (const dim of FILTER_DIMENSIONS) {
    // Base set: products passing every dimension except the one being counted.
    const base = products.filter((p) =>
      FILTER_DIMENSIONS.filter((d) => d !== dim).every((d) =>
        matchesDimension(p, d, filters[d]),
      ),
    );
    for (const opt of options[dim]) {
      counts[dim][opt.value] = base.reduce(
        (n, p) => (matchesDimension(p, dim, [opt.value]) ? n + 1 : n),
        0,
      );
    }
  }

  return counts;
}
