import { describe, it, expect } from "vitest";
import {
  applyFilters,
  computeFacetCounts,
  matchesDimension,
} from "@/lib/shop/filtering";
import { emptyFilterState } from "@/lib/types";
import type { FilterOptions, FilterState, Product } from "@/lib/types";

/** Minimal product factory — only the fields the filters read. */
function makeProduct(p: Partial<Product>): Product {
  return {
    productType: undefined,
    target: undefined,
    problems: [],
    ...p,
  } as Product;
}

const serumWomenDry = makeProduct({
  id: "p_serum",
  productType: "serum",
  target: "women",
  problems: ["dryness", "dark-spots"],
});
const creamWomenBarrier = makeProduct({
  id: "p_cream",
  productType: "cream",
  target: "women",
  problems: ["barrier-damage", "dryness"],
});
const oilMenBreakage = makeProduct({
  id: "p_oil",
  productType: "oil",
  target: "men",
  problems: ["breakage"],
});
const unisexSpray = makeProduct({
  id: "p_spray",
  productType: "spray",
  target: "unisex",
  problems: [],
});

const products = [serumWomenDry, creamWomenBarrier, oilMenBreakage, unisexSpray];

const options: FilterOptions = {
  productTypes: [
    { value: "serum", label: { ar: "", en: "Serum" } },
    { value: "cream", label: { ar: "", en: "Cream" } },
    { value: "oil", label: { ar: "", en: "Oil" } },
    { value: "spray", label: { ar: "", en: "Spray" } },
  ],
  targets: [
    { value: "women", label: { ar: "", en: "Women" } },
    { value: "men", label: { ar: "", en: "Men" } },
    { value: "unisex", label: { ar: "", en: "Unisex" } },
  ],
  problems: [
    { value: "dryness", label: { ar: "", en: "Dryness" } },
    { value: "dark-spots", label: { ar: "", en: "Dark Spots" } },
    { value: "barrier-damage", label: { ar: "", en: "Barrier" } },
    { value: "breakage", label: { ar: "", en: "Breakage" } },
  ],
};

function withFilters(partial: Partial<FilterState>): FilterState {
  return { ...emptyFilterState, ...partial };
}

describe("matchesDimension", () => {
  it("matches everything when no values selected", () => {
    expect(matchesDimension(oilMenBreakage, "productTypes", [])).toBe(true);
  });

  it("matches productType / target via equality", () => {
    expect(matchesDimension(serumWomenDry, "productTypes", ["serum"])).toBe(true);
    expect(matchesDimension(serumWomenDry, "productTypes", ["cream"])).toBe(false);
    expect(matchesDimension(serumWomenDry, "targets", ["women"])).toBe(true);
  });

  it("matches problems as an OR over the array", () => {
    expect(matchesDimension(serumWomenDry, "problems", ["dark-spots"])).toBe(true);
    expect(
      matchesDimension(serumWomenDry, "problems", ["breakage", "dryness"]),
    ).toBe(true);
    expect(matchesDimension(serumWomenDry, "problems", ["breakage"])).toBe(false);
  });
});

describe("applyFilters", () => {
  it("returns all products with an empty filter state", () => {
    expect(applyFilters(products, emptyFilterState)).toHaveLength(4);
  });

  it("ANDs across dimensions", () => {
    const res = applyFilters(products, withFilters({ targets: ["women"], problems: ["dryness"] }));
    expect(res.map((p) => p.id).sort()).toEqual(["p_cream", "p_serum"]);
  });

  it("ORs within a dimension", () => {
    const res = applyFilters(products, withFilters({ productTypes: ["serum", "oil"] }));
    expect(res.map((p) => p.id).sort()).toEqual(["p_oil", "p_serum"]);
  });
});

describe("computeFacetCounts", () => {
  it("counts every option against the full set when no filters are active", () => {
    const counts = computeFacetCounts(products, emptyFilterState, options);
    expect(counts.productTypes.serum).toBe(1);
    expect(counts.targets.women).toBe(2);
    expect(counts.problems.dryness).toBe(2);
    expect(counts.problems.breakage).toBe(1);
  });

  it("uses other active dimensions but ignores its own (faceted behavior)", () => {
    // Active target=women. productType counts should reflect women only...
    const counts = computeFacetCounts(
      products,
      withFilters({ targets: ["women"] }),
      options,
    );
    expect(counts.productTypes.serum).toBe(1);
    expect(counts.productTypes.cream).toBe(1);
    expect(counts.productTypes.oil).toBe(0); // oil is men → excluded
    // ...but target counts ignore the target filter itself, so men still shows.
    expect(counts.targets.men).toBe(1);
    expect(counts.targets.women).toBe(2);
  });

  it("reflects narrowing across two dimensions", () => {
    const counts = computeFacetCounts(
      products,
      withFilters({ targets: ["women"], problems: ["dryness"] }),
      options,
    );
    // productType count = women AND dryness, per option
    expect(counts.productTypes.serum).toBe(1);
    expect(counts.productTypes.cream).toBe(1);
    expect(counts.productTypes.spray).toBe(0);
  });
});
