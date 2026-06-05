/**
 * Shop URL <-> state (filters + sort) — pure, server/client shareable.
 *
 * Keeps the filter/sort state shareable, bookmarkable and restorable on
 * load. Parsing is validated against the canonical option lists so junk
 * query strings can never break rendering. Serialization is *additive*:
 * it preserves any unrelated params already on the URL (notably
 * `?collection=`), and omits empty dimensions and the default sort so
 * canonical URLs stay clean.
 *
 *   ?type=serum,cream&target=women&problem=dryness&sort=price-asc
 */
import { productTypeOptions, targetOptions, problemOptions } from "@/data/filters";
import { emptyFilterState, type FilterState } from "@/lib/types";
import type { ShopSort } from "@/app/shop/ShopToolbar";

/** Canonical sort values — kept in sync with `ShopSort` via `satisfies`. */
export const SHOP_SORTS = [
  "recommended",
  "best",
  "price-asc",
  "price-desc",
] as const satisfies readonly ShopSort[];

export const DEFAULT_SORT: ShopSort = "recommended";

/** Query-param keys for each filter dimension + sort. */
export const SHOP_PARAM = {
  productTypes: "type",
  targets: "target",
  problems: "problem",
  sort: "sort",
} as const;

const VALID = {
  productTypes: new Set(productTypeOptions.map((o) => o.value)),
  targets: new Set(targetOptions.map((o) => o.value)),
  problems: new Set(problemOptions.map((o) => o.value)),
} as const;

/** A read of `searchParams` — Next hands values as string | string[]. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function parseList(
  raw: string | string[] | undefined,
  valid: ReadonlySet<string>,
): string[] {
  if (!raw) return [];
  const joined = Array.isArray(raw) ? raw.join(",") : raw;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of joined.split(",")) {
    const v = part.trim();
    if (v && valid.has(v) && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/** Parse a validated FilterState from raw search params. */
export function parseShopFilters(params: RawSearchParams): FilterState {
  return {
    productTypes: parseList(params[SHOP_PARAM.productTypes], VALID.productTypes),
    targets: parseList(params[SHOP_PARAM.targets], VALID.targets),
    problems: parseList(params[SHOP_PARAM.problems], VALID.problems),
  };
}

/** Parse a validated sort value, falling back to the default. */
export function parseShopSort(params: RawSearchParams): ShopSort {
  const raw = params[SHOP_PARAM.sort];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (SHOP_SORTS as readonly string[]).includes(value ?? "")
    ? (value as ShopSort)
    : DEFAULT_SORT;
}

export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.productTypes.length > 0 ||
    filters.targets.length > 0 ||
    filters.problems.length > 0
  );
}

/**
 * Merge filter + sort state onto an existing param set (non-destructive
 * for unrelated keys like `collection`). Empty dimensions and the default
 * sort are removed so the URL collapses back to clean when cleared.
 */
export function applyShopParams(
  current: URLSearchParams,
  filters: FilterState,
  sort: ShopSort,
): URLSearchParams {
  const next = new URLSearchParams(current);
  const setOrDelete = (key: string, list: string[]) => {
    if (list.length > 0) next.set(key, list.join(","));
    else next.delete(key);
  };
  setOrDelete(SHOP_PARAM.productTypes, filters.productTypes);
  setOrDelete(SHOP_PARAM.targets, filters.targets);
  setOrDelete(SHOP_PARAM.problems, filters.problems);
  if (sort && sort !== DEFAULT_SORT) next.set(SHOP_PARAM.sort, sort);
  else next.delete(SHOP_PARAM.sort);
  return next;
}

export { emptyFilterState };
