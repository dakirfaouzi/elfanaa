import { describe, expect, it } from "vitest";
import type { UniversalProduct } from "@platform/catalog-schema";
import { CatalogMetadataSchema } from "@platform/builder-schema";
import { deriveCatalogMetadataFromProduct } from "../lib/studio/catalog-metadata-defaults";

/**
 * Tests for `catalog-metadata-defaults.ts`.
 *
 * # What we're protecting
 *
 *   • Defaults are SCHEMA-VALID — the panel never opens to a
 *     Zod-rejecting shape.
 *   • The `toFanaaExtension` heuristics are reflected unchanged
 *     (productType / target / problems / sku / upsellIds /
 *     offerTiers) so the operator-side view matches what the
 *     publisher would have computed.
 *   • Defensive sanitisers handle: float priceMinor, lowercase
 *     currency, duplicate upsell ids, partial rating objects.
 *   • Conservative-default decisions (decision 5): NO auto-badges,
 *     NO auto-stockLeft, NO auto-recentBuyers, NO auto-landingPath,
 *     NO auto-collection.
 *
 * # Why the fixture mirrors the productToDraftDocument fixture
 *
 * Same shape so the two derivation passes can be reasoned about as
 * one unit — when an operator opens a freshly-assembled draft, the
 * sections AND the catalog panel both came from this product.
 */

function makeFixture(overrides: Partial<UniversalProduct> = {}): UniversalProduct {
  return {
    id: "up_test_001",
    slug: "glow-serum",
    niche: "beauty_wellness",
    storeContext: "fanaa",
    generationRunId: "run_test_001",
    generatedAt: "2026-01-15T10:00:00.000Z",
    title: { ar: "سيروم العناية", en: "Glow Serum" },
    description: {
      ar: "سيروم مرطب يومي للبشرة الجافة، يعالج التصبغات.",
      en: "Daily hydrating serum for dry skin. Targets dark spots.",
    },
    headline: { ar: "بشرة مشرقة", en: "Radiant skin" },
    subheadline: { ar: "ترطيب مكثّف.", en: "Deep hydration." },
    benefits: [
      {
        icon: "Droplets",
        title: { ar: "ترطيب عميق", en: "Deep hydration" },
        body: { ar: "ترطيب ٢٤ ساعة.", en: "24-hour hydration." },
      },
      {
        icon: "Sparkles",
        title: { ar: "إشراقة", en: "Glow" },
        body: { ar: "إشراقة فورية.", en: "Instant glow." },
      },
    ],
    images: [],
    reviews: [],
    faq: [],
    priceHint: { amount: 19_900, currency: "SAR" },
    hooks: [],
    sources: {
      supplierUrl: "https://example.com/serum",
      scrapedAt: "2026-01-14T18:00:00.000Z",
      uploadedImages: [],
    },
    upsellSuggestions: ["barrier-cream", "hair-mask"],
    rating: { value: 4.9, count: 312 },
    ...overrides,
  };
}

describe("deriveCatalogMetadataFromProduct — shape + schema validity", () => {
  it("returns a schema-valid CatalogMetadata for a typical product", () => {
    const meta = deriveCatalogMetadataFromProduct({ product: makeFixture() });
    const parsed = CatalogMetadataSchema.safeParse(meta);
    expect(parsed.success).toBe(true);
  });

  it("returns a schema-valid CatalogMetadata for a minimal product", () => {
    const meta = deriveCatalogMetadataFromProduct({
      product: makeFixture({
        upsellSuggestions: undefined,
        rating: undefined,
        priceHint: { amount: 0, currency: "SAR" },
      }),
    });
    const parsed = CatalogMetadataSchema.safeParse(meta);
    expect(parsed.success).toBe(true);
  });
});

describe("deriveCatalogMetadataFromProduct — price", () => {
  it("copies priceHint.amount into priceMinor and currency into priceCurrency", () => {
    const meta = deriveCatalogMetadataFromProduct({
      product: makeFixture({ priceHint: { amount: 24_900, currency: "SAR" } }),
    });
    expect(meta.priceMinor).toBe(24_900);
    expect(meta.priceCurrency).toBe("SAR");
  });

  it("rounds non-integer priceHint amounts to integer minor units", () => {
    const meta = deriveCatalogMetadataFromProduct({
      product: makeFixture({
        priceHint: { amount: 19_900.6, currency: "SAR" },
      }),
    });
    expect(meta.priceMinor).toBe(19_901);
  });

  it("clamps negative priceHint amounts to 0", () => {
    const meta = deriveCatalogMetadataFromProduct({
      product: makeFixture({ priceHint: { amount: -100, currency: "SAR" } }),
    });
    expect(meta.priceMinor).toBe(0);
  });

  it("uppercases lowercase currency codes", () => {
    const meta = deriveCatalogMetadataFromProduct({
      product: makeFixture({
        priceHint: { amount: 19_900, currency: "sar" as "SAR" },
      }),
    });
    expect(meta.priceCurrency).toBe("SAR");
  });

  it("falls back to SAR for malformed currency", () => {
    const meta = deriveCatalogMetadataFromProduct({
      product: makeFixture({
        priceHint: { amount: 19_900, currency: "SAR " as "SAR" },
      }),
    });
    expect(meta.priceCurrency).toBe("SAR");
  });
});

describe("deriveCatalogMetadataFromProduct — offer tiers", () => {
  it("derives a 1/2/3-pack ladder from a positive priceHint", () => {
    const meta = deriveCatalogMetadataFromProduct({
      product: makeFixture({ priceHint: { amount: 19_900, currency: "SAR" } }),
    });
    expect(meta.offerTiers.length).toBe(3);
    expect(meta.offerTiers[0]).toEqual({
      quantity: 1,
      total: { amount: 19_900, currency: "SAR" },
    });
    expect(meta.offerTiers[1].quantity).toBe(2);
    expect(meta.offerTiers[2].quantity).toBe(3);
    // The 2/3-pack totals should drop monotonically per unit (volume
    // discount semantics from `deriveOfferTiers`).
    expect(meta.offerTiers[1].total.amount).toBeLessThan(19_900 * 2);
    expect(meta.offerTiers[2].total.amount).toBeLessThan(19_900 * 3);
  });

  it("emits an empty ladder when priceHint is zero", () => {
    const meta = deriveCatalogMetadataFromProduct({
      product: makeFixture({ priceHint: { amount: 0, currency: "SAR" } }),
    });
    expect(meta.offerTiers).toEqual([]);
  });
});

describe("deriveCatalogMetadataFromProduct — taxonomy heuristics", () => {
  it("infers productType from title tokens (serum)", () => {
    const meta = deriveCatalogMetadataFromProduct({ product: makeFixture() });
    expect(meta.productType).toBe("serum");
  });

  it("infers target = women for beauty/wellness products by default", () => {
    const meta = deriveCatalogMetadataFromProduct({ product: makeFixture() });
    expect(meta.target).toBe("women");
  });

  it("infers problems as an ARRAY (multi-value taxonomy)", () => {
    // Fixture description mentions both hydration ("hydrating") and
    // "dark spots" so we expect at least dryness + dark-spots.
    const meta = deriveCatalogMetadataFromProduct({ product: makeFixture() });
    expect(Array.isArray(meta.problems)).toBe(true);
    expect(meta.problems).toContain("dark-spots");
    expect(meta.problems).toContain("dryness");
  });

  it("returns an EMPTY problems array (not null) when no keywords match", () => {
    const meta = deriveCatalogMetadataFromProduct({
      product: makeFixture({
        title: { ar: "منتج", en: "Generic product" },
        description: { ar: "وصف عام", en: "Generic description." },
        headline: undefined,
        subheadline: undefined,
        benefits: [],
        ingredients: [],
      }),
    });
    expect(meta.problems).toEqual([]);
  });
});

describe("deriveCatalogMetadataFromProduct — SKU + upsells + rating", () => {
  it("derives a deterministic SKU via the publisher heuristic", () => {
    const meta1 = deriveCatalogMetadataFromProduct({ product: makeFixture() });
    const meta2 = deriveCatalogMetadataFromProduct({ product: makeFixture() });
    expect(meta1.sku).toBe(meta2.sku);
    expect(meta1.sku).toMatch(/^FN-/); // FanaaPublisher's SKU prefix.
  });

  it("carries product.upsellSuggestions into upsellIds, dedupes, preserves order", () => {
    const meta = deriveCatalogMetadataFromProduct({
      product: makeFixture({
        upsellSuggestions: ["barrier-cream", "hair-mask", "barrier-cream"],
      }),
    });
    expect(meta.upsellIds).toEqual(["barrier-cream", "hair-mask"]);
  });

  it("returns empty upsellIds when product has no suggestions", () => {
    const meta = deriveCatalogMetadataFromProduct({
      product: makeFixture({ upsellSuggestions: undefined }),
    });
    expect(meta.upsellIds).toEqual([]);
  });

  it("carries product.rating when present", () => {
    const meta = deriveCatalogMetadataFromProduct({ product: makeFixture() });
    expect(meta.rating).toEqual({ value: 4.9, count: 312 });
  });

  it("returns null rating when product.rating is missing", () => {
    const meta = deriveCatalogMetadataFromProduct({
      product: makeFixture({ rating: undefined }),
    });
    expect(meta.rating).toBeNull();
  });

  it("returns null rating when rating.value is out of 0..5", () => {
    const meta = deriveCatalogMetadataFromProduct({
      product: makeFixture({ rating: { value: 7, count: 100 } }),
    });
    expect(meta.rating).toBeNull();
  });
});

describe("deriveCatalogMetadataFromProduct — conservative defaults (decision 5)", () => {
  it("leaves badges empty (no auto-generation from positioning/tagline)", () => {
    const meta = deriveCatalogMetadataFromProduct({ product: makeFixture() });
    expect(meta.badges).toEqual([]);
  });

  it("leaves stockLeft null (operator decides scarcity)", () => {
    const meta = deriveCatalogMetadataFromProduct({ product: makeFixture() });
    expect(meta.stockLeft).toBeNull();
  });

  it("leaves recentBuyers null (operator decides scarcity)", () => {
    const meta = deriveCatalogMetadataFromProduct({ product: makeFixture() });
    expect(meta.recentBuyers).toBeNull();
  });

  it("leaves landingPath null (bespoke landings are bespoke)", () => {
    const meta = deriveCatalogMetadataFromProduct({ product: makeFixture() });
    expect(meta.landingPath).toBeNull();
  });

  it("leaves collection null (operator picks /shop placement)", () => {
    const meta = deriveCatalogMetadataFromProduct({ product: makeFixture() });
    expect(meta.collection).toBeNull();
  });
});

describe("deriveCatalogMetadataFromProduct — determinism", () => {
  it("produces byte-identical output across calls with identical input", () => {
    const a = deriveCatalogMetadataFromProduct({ product: makeFixture() });
    const b = deriveCatalogMetadataFromProduct({ product: makeFixture() });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
