import { describe, it, expect } from "vitest";
import { normalizeUpsellRef, resolveUpsellRefs } from "@/lib/catalog/upsell-refs";

describe("normalizeUpsellRef", () => {
  it("passes bare ids/slugs through", () => {
    expect(normalizeUpsellRef("barrier-cream")).toBe("barrier-cream");
    expect(normalizeUpsellRef("run_mpxd8ywc_a77to0pq")).toBe("run_mpxd8ywc_a77to0pq");
  });

  it("strips storefront/studio path prefixes", () => {
    expect(normalizeUpsellRef("/products/run_mpxd8ywc_a77to0pq")).toBe(
      "run_mpxd8ywc_a77to0pq",
    );
    expect(normalizeUpsellRef("/sugarbear")).toBe("sugarbear");
    expect(normalizeUpsellRef("/p/glow-serum")).toBe("glow-serum");
  });

  it("handles absolute URLs, query strings, and trailing slashes", () => {
    expect(normalizeUpsellRef("https://elfanaa.com/products/glow-serum")).toBe(
      "glow-serum",
    );
    expect(normalizeUpsellRef("/products/glow-serum?ref=cart")).toBe("glow-serum");
    expect(normalizeUpsellRef("/products/glow-serum/")).toBe("glow-serum");
  });

  it("returns empty for blank input", () => {
    expect(normalizeUpsellRef("")).toBe("");
    expect(normalizeUpsellRef("   ")).toBe("");
    expect(normalizeUpsellRef("/")).toBe("");
  });
});

describe("resolveUpsellRefs", () => {
  const catalog = [
    { id: "p_001", slug: "glow-serum" },
    { id: "p_002", slug: "barrier-cream" },
    { id: "run_abc", slug: "run_abc" },
    { id: "run_xyz", slug: "run_xyz" },
  ];

  it("resolves by id OR slug, preserving order", () => {
    const out = resolveUpsellRefs(["barrier-cream", "p_001"], catalog);
    expect(out.map((p) => p.id)).toEqual(["p_002", "p_001"]);
  });

  it("resolves path/URL forms and AI-generated targets", () => {
    const out = resolveUpsellRefs(
      ["/products/run_abc", "/sugarbear", "run_xyz"],
      catalog,
    );
    // /sugarbear isn't in the catalog → skipped; the two run_* resolve.
    expect(out.map((p) => p.id)).toEqual(["run_abc", "run_xyz"]);
  });

  it("skips excluded + self + duplicate + unresolvable refs", () => {
    const out = resolveUpsellRefs(
      ["p_001", "p_001", "glow-serum", "p_002", "does-not-exist"],
      catalog,
      { excludeIds: ["p_002"] },
    );
    // p_001 once (dedup by id even via id+slug), p_002 excluded, junk dropped.
    expect(out.map((p) => p.id)).toEqual(["p_001"]);
  });

  it("returns empty for empty refs", () => {
    expect(resolveUpsellRefs([], catalog)).toEqual([]);
  });
});
