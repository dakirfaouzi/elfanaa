import { describe, expect, it } from "vitest";
import {
  CatalogMetadataSchema,
  CatalogOfferTierSchema,
  CatalogBadgeSchema,
  CatalogRatingSchema,
  emptyCatalogMetadata,
  hasMeaningfulCatalogMetadata,
} from "../catalog-metadata";
import { DraftDocumentSchema } from "../draft";
import { makeBlankDraft } from "../factories";

/**
 * Tests for the Phase 2.3 `CatalogMetadata` schema.
 *
 * # What we're protecting
 *
 *   • The shape stays in lock-step with `storefront_catalog_product`
 *     (see `packages/db/prisma/schema.prisma:499+`) and the
 *     storefront merge contract (`apps/fanaa/lib/catalog/merge.ts`).
 *   • Backward compatibility: a `DraftDocument` written before
 *     Phase 2.3 (no `catalogMetadata` field) still parses.
 *   • `priceMinor` is integer-only — float drift via JSON round
 *     trips is the canonical regression.
 *   • `landingPath` rejects absolute URLs so cross-origin redirects
 *     never leak into the storefront's internal link graph.
 */

describe("CatalogMetadataSchema — primitives", () => {
  it("accepts a fully-populated catalog metadata object", () => {
    const meta = {
      priceMinor: 19_900,
      priceCurrency: "SAR",
      sku: "FN-SERUM-001",
      offerTiers: [
        { quantity: 1, total: { amount: 19_900, currency: "SAR" } },
        { quantity: 2, total: { amount: 27_900, currency: "SAR" } },
        { quantity: 3, total: { amount: 34_900, currency: "SAR" } },
      ],
      collection: "face",
      productType: "serum",
      target: "women",
      problems: ["dark-spots", "dryness"],
      badges: [{ ar: "الأكثر طلباً", en: "Best seller" }],
      rating: { value: 4.9, count: 312 },
      stockLeft: 14,
      recentBuyers: 31,
      upsellIds: ["barrier-cream", "hair-mask"],
      landingPath: null,
    };
    const result = CatalogMetadataSchema.safeParse(meta);
    expect(result.success).toBe(true);
  });

  it("accepts an empty-but-typed metadata via emptyCatalogMetadata()", () => {
    const meta = emptyCatalogMetadata();
    const result = CatalogMetadataSchema.safeParse(meta);
    expect(result.success).toBe(true);
    expect(meta.priceMinor).toBe(0);
    expect(meta.priceCurrency).toBe("SAR");
    expect(meta.offerTiers).toEqual([]);
    expect(meta.problems).toEqual([]);
    expect(meta.badges).toEqual([]);
  });

  it("rejects non-integer priceMinor (float drift guard)", () => {
    const result = CatalogMetadataSchema.safeParse({
      priceMinor: 19_900.5,
      priceCurrency: "SAR",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative priceMinor", () => {
    const result = CatalogMetadataSchema.safeParse({
      priceMinor: -1,
      priceCurrency: "SAR",
    });
    expect(result.success).toBe(false);
  });

  it("rejects currency codes shorter than 3 chars", () => {
    const result = CatalogMetadataSchema.safeParse({
      priceMinor: 1000,
      priceCurrency: "SA",
    });
    expect(result.success).toBe(false);
  });

  it("rejects currency codes longer than 3 chars", () => {
    const result = CatalogMetadataSchema.safeParse({
      priceMinor: 1000,
      priceCurrency: "SARR",
    });
    expect(result.success).toBe(false);
  });

  it("allows null on every nullable field", () => {
    const result = CatalogMetadataSchema.safeParse({
      priceMinor: 19_900,
      priceCurrency: "SAR",
      sku: null,
      collection: null,
      productType: null,
      target: null,
      rating: null,
      stockLeft: null,
      recentBuyers: null,
      landingPath: null,
    });
    expect(result.success).toBe(true);
  });

  it("applies defaults for the array fields when omitted", () => {
    const result = CatalogMetadataSchema.safeParse({
      priceMinor: 19_900,
      priceCurrency: "SAR",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.offerTiers).toEqual([]);
      expect(result.data.problems).toEqual([]);
      expect(result.data.badges).toEqual([]);
      expect(result.data.upsellIds).toEqual([]);
    }
  });
});

describe("CatalogOfferTierSchema", () => {
  it("accepts a 3-tier ladder mirroring fanaa snapshot", () => {
    const ladder = [
      { quantity: 1, total: { amount: 19_900, currency: "SAR" } },
      { quantity: 2, total: { amount: 27_900, currency: "SAR" } },
      { quantity: 3, total: { amount: 34_900, currency: "SAR" } },
    ];
    for (const tier of ladder) {
      expect(CatalogOfferTierSchema.safeParse(tier).success).toBe(true);
    }
  });

  it("rejects quantity = 0", () => {
    const result = CatalogOfferTierSchema.safeParse({
      quantity: 0,
      total: { amount: 19_900, currency: "SAR" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects quantity > 99", () => {
    const result = CatalogOfferTierSchema.safeParse({
      quantity: 100,
      total: { amount: 19_900, currency: "SAR" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer total amount", () => {
    const result = CatalogOfferTierSchema.safeParse({
      quantity: 1,
      total: { amount: 19_900.5, currency: "SAR" },
    });
    expect(result.success).toBe(false);
  });
});

describe("CatalogBadgeSchema", () => {
  it("requires both ar and en", () => {
    expect(
      CatalogBadgeSchema.safeParse({ ar: "الأكثر طلباً", en: "Best" }).success,
    ).toBe(true);
    expect(
      CatalogBadgeSchema.safeParse({ ar: "الأكثر طلباً" }).success,
    ).toBe(false);
    expect(CatalogBadgeSchema.safeParse({ en: "Best" }).success).toBe(false);
  });

  it("rejects empty strings in either locale", () => {
    expect(
      CatalogBadgeSchema.safeParse({ ar: "", en: "Best" }).success,
    ).toBe(false);
    expect(
      CatalogBadgeSchema.safeParse({ ar: "الأكثر طلباً", en: "" }).success,
    ).toBe(false);
  });

  it("rejects badges longer than 60 chars", () => {
    const long = "a".repeat(61);
    expect(
      CatalogBadgeSchema.safeParse({ ar: long, en: "Best" }).success,
    ).toBe(false);
  });
});

describe("CatalogRatingSchema", () => {
  it("accepts standard 5-star ratings", () => {
    expect(
      CatalogRatingSchema.safeParse({ value: 4.9, count: 312 }).success,
    ).toBe(true);
    expect(CatalogRatingSchema.safeParse({ value: 0, count: 0 }).success).toBe(
      true,
    );
    expect(CatalogRatingSchema.safeParse({ value: 5, count: 1 }).success).toBe(
      true,
    );
  });

  it("rejects value outside 0..5", () => {
    expect(
      CatalogRatingSchema.safeParse({ value: -0.1, count: 0 }).success,
    ).toBe(false);
    expect(
      CatalogRatingSchema.safeParse({ value: 5.01, count: 0 }).success,
    ).toBe(false);
  });

  it("rejects non-integer count", () => {
    expect(
      CatalogRatingSchema.safeParse({ value: 4.5, count: 312.7 }).success,
    ).toBe(false);
  });
});

describe("landingPath", () => {
  it("accepts relative paths", () => {
    const result = CatalogMetadataSchema.safeParse({
      priceMinor: 19_900,
      priceCurrency: "SAR",
      landingPath: "/sugarbear",
    });
    expect(result.success).toBe(true);
  });

  it("rejects absolute https URLs (must stay internal)", () => {
    const result = CatalogMetadataSchema.safeParse({
      priceMinor: 19_900,
      priceCurrency: "SAR",
      landingPath: "https://elsewhere.com/redirect",
    });
    expect(result.success).toBe(false);
  });

  it("rejects protocol-relative URLs", () => {
    const result = CatalogMetadataSchema.safeParse({
      priceMinor: 19_900,
      priceCurrency: "SAR",
      landingPath: "//cdn.example.com",
    });
    expect(result.success).toBe(false);
  });
});

describe("Backward compatibility — DraftDocument round trip", () => {
  it("accepts a draft document WITHOUT catalogMetadata (legacy payload)", () => {
    const legacy = {
      version: 1,
      meta: { title: { en: "X" }, slug: "x-product", keywords: [] },
      sections: [],
    };
    const result = DraftDocumentSchema.safeParse(legacy);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.catalogMetadata).toBeUndefined();
    }
  });

  it("accepts a draft document WITH catalogMetadata", () => {
    const fresh = {
      version: 1,
      meta: { title: { en: "X" }, slug: "x-product", keywords: [] },
      sections: [],
      catalogMetadata: emptyCatalogMetadata(),
    };
    const result = DraftDocumentSchema.safeParse(fresh);
    expect(result.success).toBe(true);
  });

  it("makeBlankDraft seeds an empty catalogMetadata that round-trips", () => {
    let counter = 0;
    const draft = makeBlankDraft({
      slug: "fresh-draft",
      title: { en: "Fresh draft" },
      newId: () => `sec_${++counter}`,
    });
    expect(draft.catalogMetadata).toBeDefined();
    const result = DraftDocumentSchema.safeParse(draft);
    expect(result.success).toBe(true);
  });
});

describe("hasMeaningfulCatalogMetadata", () => {
  it("returns false on the empty default (priceMinor = 0)", () => {
    expect(hasMeaningfulCatalogMetadata(emptyCatalogMetadata())).toBe(false);
  });

  it("returns true once priceMinor > 0", () => {
    const meta = { ...emptyCatalogMetadata(), priceMinor: 19_900 };
    expect(hasMeaningfulCatalogMetadata(meta)).toBe(true);
  });
});
