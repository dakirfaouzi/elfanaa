import { describe, it, expect } from "vitest";
import {
  applyShopParams,
  DEFAULT_SORT,
  parseShopFilters,
  parseShopSort,
  SHOP_PARAM,
} from "@/lib/shop/url-state";
import type { FilterState } from "@/lib/types";

describe("parseShopFilters", () => {
  it("returns empty state for empty params", () => {
    expect(parseShopFilters({})).toEqual({
      productTypes: [],
      targets: [],
      problems: [],
    });
  });

  it("parses comma lists and maps keys to dimensions", () => {
    const f = parseShopFilters({
      type: "serum,cream",
      target: "women",
      problem: "dryness,dark-spots",
    });
    expect(f.productTypes).toEqual(["serum", "cream"]);
    expect(f.targets).toEqual(["women"]);
    expect(f.problems).toEqual(["dryness", "dark-spots"]);
  });

  it("drops invalid, blank and duplicate values", () => {
    const f = parseShopFilters({
      type: "serum,serum,bogus, ,cream",
      target: "alien",
      problem: "",
    });
    expect(f.productTypes).toEqual(["serum", "cream"]);
    expect(f.targets).toEqual([]);
    expect(f.problems).toEqual([]);
  });

  it("handles array-valued params", () => {
    const f = parseShopFilters({ type: ["serum", "oil"] });
    expect(f.productTypes).toEqual(["serum", "oil"]);
  });
});

describe("parseShopSort", () => {
  it("defaults when missing or invalid", () => {
    expect(parseShopSort({})).toBe(DEFAULT_SORT);
    expect(parseShopSort({ sort: "nonsense" })).toBe(DEFAULT_SORT);
  });

  it("accepts valid sorts", () => {
    expect(parseShopSort({ sort: "price-asc" })).toBe("price-asc");
    expect(parseShopSort({ sort: "best" })).toBe("best");
  });
});

describe("applyShopParams", () => {
  const filters: FilterState = {
    productTypes: ["serum"],
    targets: [],
    problems: ["dryness", "dark-spots"],
  };

  it("serializes active dimensions and omits empty ones", () => {
    const out = applyShopParams(new URLSearchParams(), filters, "price-asc");
    expect(out.get(SHOP_PARAM.productTypes)).toBe("serum");
    expect(out.get(SHOP_PARAM.problems)).toBe("dryness,dark-spots");
    expect(out.has(SHOP_PARAM.targets)).toBe(false);
    expect(out.get(SHOP_PARAM.sort)).toBe("price-asc");
  });

  it("omits the default sort", () => {
    const out = applyShopParams(new URLSearchParams(), filters, DEFAULT_SORT);
    expect(out.has(SHOP_PARAM.sort)).toBe(false);
  });

  it("preserves unrelated params (e.g. collection)", () => {
    const out = applyShopParams(
      new URLSearchParams("collection=face"),
      filters,
      "best",
    );
    expect(out.get("collection")).toBe("face");
  });

  it("clears dimensions back out when emptied (round-trip)", () => {
    const start = applyShopParams(
      new URLSearchParams("collection=face"),
      filters,
      "best",
    );
    const cleared = applyShopParams(
      start,
      { productTypes: [], targets: [], problems: [] },
      DEFAULT_SORT,
    );
    expect(cleared.has(SHOP_PARAM.productTypes)).toBe(false);
    expect(cleared.has(SHOP_PARAM.problems)).toBe(false);
    expect(cleared.has(SHOP_PARAM.sort)).toBe(false);
    expect(cleared.get("collection")).toBe("face");
  });

  it("round-trips through parse (serialize → parse is stable)", () => {
    const serialized = applyShopParams(new URLSearchParams(), filters, "price-desc");
    const params = Object.fromEntries(serialized.entries());
    expect(parseShopFilters(params)).toEqual(filters);
    expect(parseShopSort(params)).toBe("price-desc");
  });
});
