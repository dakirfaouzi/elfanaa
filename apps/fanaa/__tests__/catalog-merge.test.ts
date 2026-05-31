/**
 * Catalog merge / synthesise / assemble — pure-function tests.
 *
 * # Scope (Phase 2.4)
 *
 * These tests pin the contract of the M12 / Step 2 hybrid catalog
 * model. Specifically they cover:
 *
 *   1. `mergeCatalogProduct` — snapshot ↔ DB overlay rules, including
 *      null vs empty-array semantics, corrupt-JSON fallback, and the
 *      slug-mismatch warning path.
 *
 *   2. `synthesiseProductFromRow` — degraded-Product construction for
 *      AI-generated rows with no matching snapshot entry, including
 *      the Phase 2.4 hardening (closed-enum validation + price /
 *      currency sanitisation).
 *
 *   3. `assembleCatalogProducts` — the full live-catalog assembly
 *      contract: snapshot declaration order first, DB-only rows
 *      synthesised last, no duplicates on slug collision.
 *
 * Together they guarantee that any DB row landed by the Studio
 * publish flow (Phase 2.3) renders into a type-safe `Product` value
 * that the storefront's ProductCard / PDP / filter system can
 * consume — even if the row is missing fields, has invalid enums,
 * or carries a malformed price.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Product, ProductImage } from "@/lib/types";
import type { CatalogRow } from "@/lib/catalog/types";
import {
  assembleCatalogProducts,
  mergeCatalogProduct,
  synthesiseProductFromRow,
} from "@/lib/catalog/merge";
import { PLACEHOLDER_PRODUCT_IMAGE } from "@/lib/product-image";

/* -------------------------------------------------------------------------- */
/*                                  Fixtures                                   */
/* -------------------------------------------------------------------------- */

const SNAPSHOT_IMAGE: ProductImage = {
  src: "https://example.test/snapshot.webp",
  alt: { ar: "صورة", en: "image" },
};

function makeSnapshotProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p_001",
    slug: "glow-serum",
    sku: "FN-SERUM-001",
    title: { ar: "سيروم الإشراق", en: "Glow Serum" },
    description: { ar: "وصف", en: "description" },
    images: [SNAPSHOT_IMAGE],
    price: { amount: 19900, currency: "SAR" },
    offerTiers: [
      { quantity: 1, total: { amount: 19900, currency: "SAR" } },
      { quantity: 2, total: { amount: 27900, currency: "SAR" } },
      { quantity: 3, total: { amount: 34900, currency: "SAR" } },
    ],
    badges: [
      { ar: "الأكثر طلباً", en: "Most ordered" },
    ],
    rating: { value: 4.9, count: 1240 },
    collection: "face",
    productType: "serum",
    target: "women",
    problems: ["dark-spots", "uneven-tone"],
    upsellIds: ["p_002"],
    stockLeft: 47,
    recentBuyers: 219,
    landingPath: "/glow-serum",
    headline: { ar: "ذهب التبقّع", en: "Spots fade." },
    subheadline: { ar: "سيروم يومي", en: "Daily serum" },
    lifestyleImage: SNAPSHOT_IMAGE,
    benefits: [
      { icon: "Sparkles", title: { ar: "إشراق", en: "Glow" }, body: { ar: "نص", en: "body" } },
    ],
    faq: [
      { q: { ar: "س", en: "Q" }, a: { ar: "ج", en: "A" } },
    ],
    reviews: [
      {
        name: { ar: "نور", en: "Noor" },
        city: { ar: "الرياض", en: "Riyadh" },
        rating: 5,
        body: { ar: "نتائج رائعة", en: "Great results" },
        date: "2026-04-15",
        verified: true,
      },
    ],
    ingredients: [
      { name: { ar: "فيتامين", en: "Vitamin C" }, role: { ar: "دور", en: "role" } },
    ],
    ...overrides,
  };
}

function makeDbRow(overrides: Partial<CatalogRow> = {}): CatalogRow {
  return {
    id: "row_001",
    storeId: "fanaa",
    slug: "glow-serum",
    source: "curated",
    publishedProductId: null,
    sku: null,
    priceMinor: 19900,
    priceCurrency: "SAR",
    offerTiers: [],
    collection: null,
    productType: null,
    target: null,
    problems: [],
    badges: [],
    rating: null,
    stockLeft: null,
    recentBuyers: null,
    upsellIds: [],
    landingPath: null,
    heroImageUrl: null,
    croContent: null,
    isLive: true,
    createdAt: new Date("2026-05-01T00:00:00Z"),
    updatedAt: new Date("2026-05-15T00:00:00Z"),
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/*                              Console silencer                               */
/* -------------------------------------------------------------------------- */
//
// merge.ts emits `console.warn` for several defensive branches
// (slug mismatch, invalid enum, malformed price). The tests assert
// on the warn calls explicitly where the behaviour is the test's
// purpose; otherwise we silence them to keep the output readable.

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

/* -------------------------------------------------------------------------- */
/*                              mergeCatalogProduct                            */
/* -------------------------------------------------------------------------- */

describe("mergeCatalogProduct", () => {
  it("returns snapshot unchanged when dbRow is null", () => {
    const snapshot = makeSnapshotProduct();
    const merged = mergeCatalogProduct(snapshot, null);
    expect(merged).toEqual(snapshot);
  });

  it("does not mutate the snapshot input", () => {
    const snapshot = makeSnapshotProduct();
    const snapshotCopy = JSON.parse(JSON.stringify(snapshot));
    mergeCatalogProduct(snapshot, makeDbRow({ sku: "DB-OVERRIDE" }));
    expect(snapshot).toEqual(snapshotCopy);
  });

  it("identity (id, slug) always wins from the snapshot", () => {
    const snapshot = makeSnapshotProduct({ id: "p_001", slug: "glow-serum" });
    const dbRow = makeDbRow({ id: "row_xyz", slug: "glow-serum" });
    const merged = mergeCatalogProduct(snapshot, dbRow);
    expect(merged.id).toBe("p_001");
    expect(merged.slug).toBe("glow-serum");
  });

  it("warns on slug mismatch but keeps snapshot's slug", () => {
    const snapshot = makeSnapshotProduct({ slug: "glow-serum" });
    const dbRow = makeDbRow({ slug: "different-slug" });
    const merged = mergeCatalogProduct(snapshot, dbRow);
    expect(merged.slug).toBe("glow-serum");
    expect(warnSpy).toHaveBeenCalledWith(
      "[catalog/merge] slug mismatch; snapshot wins",
      expect.objectContaining({ snapshotSlug: "glow-serum", dbSlug: "different-slug" }),
    );
  });

  it("DB price (minor + currency) overrides snapshot", () => {
    const snapshot = makeSnapshotProduct();
    const dbRow = makeDbRow({ priceMinor: 12345, priceCurrency: "AED" });
    const merged = mergeCatalogProduct(snapshot, dbRow);
    expect(merged.price).toEqual({ amount: 12345, currency: "AED" });
  });

  it("DB sku overrides snapshot when present", () => {
    const merged = mergeCatalogProduct(
      makeSnapshotProduct({ sku: "SNAPSHOT-SKU" }),
      makeDbRow({ sku: "DB-SKU" }),
    );
    expect(merged.sku).toBe("DB-SKU");
  });

  it("DB sku null falls back to snapshot", () => {
    const merged = mergeCatalogProduct(
      makeSnapshotProduct({ sku: "SNAPSHOT-SKU" }),
      makeDbRow({ sku: null }),
    );
    expect(merged.sku).toBe("SNAPSHOT-SKU");
  });

  it("DB sku empty string falls back to snapshot", () => {
    const merged = mergeCatalogProduct(
      makeSnapshotProduct({ sku: "SNAPSHOT-SKU" }),
      makeDbRow({ sku: "" }),
    );
    expect(merged.sku).toBe("SNAPSHOT-SKU");
  });

  it("DB offerTiers overrides snapshot when non-empty + valid", () => {
    const snapshot = makeSnapshotProduct();
    const dbRow = makeDbRow({
      offerTiers: [
        { quantity: 1, total: { amount: 9900, currency: "SAR" } },
        { quantity: 2, total: { amount: 17900, currency: "SAR" } },
      ],
    });
    const merged = mergeCatalogProduct(snapshot, dbRow);
    expect(merged.offerTiers).toHaveLength(2);
    expect(merged.offerTiers?.[0]).toEqual({
      quantity: 1,
      total: { amount: 9900, currency: "SAR" },
    });
  });

  it("DB empty-array offerTiers falls back to snapshot (not 'cleared')", () => {
    const snapshot = makeSnapshotProduct();
    const dbRow = makeDbRow({ offerTiers: [] });
    const merged = mergeCatalogProduct(snapshot, dbRow);
    expect(merged.offerTiers).toHaveLength(3);
  });

  it("DB malformed offerTiers JSON falls back to snapshot", () => {
    const snapshot = makeSnapshotProduct();
    const dbRow = makeDbRow({
      offerTiers: [{ quantity: "two", total: "lol" }],
    });
    const merged = mergeCatalogProduct(snapshot, dbRow);
    expect(merged.offerTiers).toHaveLength(3);
  });

  it("DB badges (valid bilingual) override snapshot", () => {
    const merged = mergeCatalogProduct(
      makeSnapshotProduct(),
      makeDbRow({
        badges: [{ ar: "جديد", en: "New" }],
      }),
    );
    expect(merged.badges).toEqual([{ ar: "جديد", en: "New" }]);
  });

  it("DB badges missing 'en' falls back to snapshot", () => {
    const snapshot = makeSnapshotProduct();
    const merged = mergeCatalogProduct(
      snapshot,
      makeDbRow({ badges: [{ ar: "جديد" }] }),
    );
    expect(merged.badges).toEqual(snapshot.badges);
  });

  it("DB rating with valid shape overrides snapshot", () => {
    const merged = mergeCatalogProduct(
      makeSnapshotProduct(),
      makeDbRow({ rating: { value: 4.5, count: 500 } }),
    );
    expect(merged.rating).toEqual({ value: 4.5, count: 500 });
  });

  it("DB rating with malformed shape falls back to snapshot", () => {
    const snapshot = makeSnapshotProduct();
    const merged = mergeCatalogProduct(
      snapshot,
      makeDbRow({ rating: { value: "5", count: null } }),
    );
    expect(merged.rating).toEqual(snapshot.rating);
  });

  it("DB collection overrides snapshot", () => {
    const merged = mergeCatalogProduct(
      makeSnapshotProduct({ collection: "face" }),
      makeDbRow({ collection: "routine" }),
    );
    expect(merged.collection).toBe("routine");
  });

  it("DB productType overrides snapshot", () => {
    const merged = mergeCatalogProduct(
      makeSnapshotProduct({ productType: "serum" }),
      makeDbRow({ productType: "cream" }),
    );
    expect(merged.productType).toBe("cream");
  });

  it("DB target overrides snapshot", () => {
    const merged = mergeCatalogProduct(
      makeSnapshotProduct({ target: "women" }),
      makeDbRow({ target: "unisex" }),
    );
    expect(merged.target).toBe("unisex");
  });

  it("DB problems non-empty overrides snapshot", () => {
    const merged = mergeCatalogProduct(
      makeSnapshotProduct(),
      makeDbRow({ problems: ["dryness", "pores"] }),
    );
    expect(merged.problems).toEqual(["dryness", "pores"]);
  });

  it("DB problems empty falls back to snapshot", () => {
    const snapshot = makeSnapshotProduct({ problems: ["dark-spots"] });
    const merged = mergeCatalogProduct(snapshot, makeDbRow({ problems: [] }));
    expect(merged.problems).toEqual(["dark-spots"]);
  });

  it("DB upsellIds non-empty overrides snapshot", () => {
    const merged = mergeCatalogProduct(
      makeSnapshotProduct({ upsellIds: ["p_002"] }),
      makeDbRow({ upsellIds: ["p_003", "p_004"] }),
    );
    expect(merged.upsellIds).toEqual(["p_003", "p_004"]);
  });

  it("DB stockLeft (positive integer) overrides snapshot", () => {
    const merged = mergeCatalogProduct(
      makeSnapshotProduct({ stockLeft: 47 }),
      makeDbRow({ stockLeft: 12 }),
    );
    expect(merged.stockLeft).toBe(12);
  });

  it("DB stockLeft zero is respected (overrides snapshot)", () => {
    const merged = mergeCatalogProduct(
      makeSnapshotProduct({ stockLeft: 47 }),
      makeDbRow({ stockLeft: 0 }),
    );
    expect(merged.stockLeft).toBe(0);
  });

  it("DB stockLeft null falls back to snapshot", () => {
    const merged = mergeCatalogProduct(
      makeSnapshotProduct({ stockLeft: 47 }),
      makeDbRow({ stockLeft: null }),
    );
    expect(merged.stockLeft).toBe(47);
  });

  it("DB recentBuyers (positive integer) overrides snapshot", () => {
    const merged = mergeCatalogProduct(
      makeSnapshotProduct({ recentBuyers: 219 }),
      makeDbRow({ recentBuyers: 99 }),
    );
    expect(merged.recentBuyers).toBe(99);
  });

  it("DB landingPath overrides snapshot", () => {
    const merged = mergeCatalogProduct(
      makeSnapshotProduct({ landingPath: "/glow-serum" }),
      makeDbRow({ landingPath: "/featured/glow-serum" }),
    );
    expect(merged.landingPath).toBe("/featured/glow-serum");
  });

  it("snapshot CRO content (headline, benefits, faq, reviews, ingredients) carries through unchanged", () => {
    const snapshot = makeSnapshotProduct();
    const dbRow = makeDbRow({ priceMinor: 99 });
    const merged = mergeCatalogProduct(snapshot, dbRow);
    expect(merged.headline).toEqual(snapshot.headline);
    expect(merged.subheadline).toEqual(snapshot.subheadline);
    expect(merged.lifestyleImage).toEqual(snapshot.lifestyleImage);
    expect(merged.benefits).toEqual(snapshot.benefits);
    expect(merged.faq).toEqual(snapshot.faq);
    expect(merged.reviews).toEqual(snapshot.reviews);
    expect(merged.ingredients).toEqual(snapshot.ingredients);
  });

  it("snapshot images always carry through (DB never touches images)", () => {
    const snapshot = makeSnapshotProduct();
    const dbRow = makeDbRow();
    const merged = mergeCatalogProduct(snapshot, dbRow);
    expect(merged.images).toEqual(snapshot.images);
  });

  it("optional CRO fields stay undefined when absent from snapshot", () => {
    const snapshot = makeSnapshotProduct({
      headline: undefined,
      benefits: undefined,
      faq: undefined,
    });
    const merged = mergeCatalogProduct(snapshot, makeDbRow());
    expect(merged.headline).toBeUndefined();
    expect(merged.benefits).toBeUndefined();
    expect(merged.faq).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/*                            synthesiseProductFromRow                         */
/* -------------------------------------------------------------------------- */

describe("synthesiseProductFromRow", () => {
  it("builds a renderable Product from a minimal valid row", () => {
    const row = makeDbRow({
      id: "row_new",
      slug: "ai-product",
      priceMinor: 12500,
      priceCurrency: "SAR",
    });
    const product = synthesiseProductFromRow(row);
    expect(product.id).toBe("ai-product");
    expect(product.slug).toBe("ai-product");
    expect(product.price).toEqual({ amount: 12500, currency: "SAR" });
  });

  describe("images contract (Phase 2.4.1 regression guard)", () => {
    it("seeds the placeholder image so images is NEVER empty", () => {
      const product = synthesiseProductFromRow(makeDbRow());
      expect(product.images).toHaveLength(1);
      expect(product.images[0]).toEqual(PLACEHOLDER_PRODUCT_IMAGE);
    });

    it("placeholder image carries both ar and en alt text (bilingual contract)", () => {
      const product = synthesiseProductFromRow(makeDbRow());
      const image = product.images[0]!;
      expect(typeof image.alt.ar).toBe("string");
      expect(typeof image.alt.en).toBe("string");
      expect(image.alt.ar.length).toBeGreaterThan(0);
      expect(image.alt.en.length).toBeGreaterThan(0);
    });

    it("placeholder image src is an inline data URL (no external dependency, no /public copy)", () => {
      // Phase 2.4.3: the placeholder was migrated from
      // `/placeholder-product.svg` to an inline `data:image/svg+xml`
      // URL so next/image auto-bypasses the optimizer and we no
      // longer depend on `dangerouslyAllowSVG`, the optimizer hop,
      // or the `public/` folder being copied into the standalone
      // Docker bundle. This assertion pins that contract.
      const product = synthesiseProductFromRow(makeDbRow());
      const image = product.images[0]!;
      expect(image.src.startsWith("data:image/svg+xml")).toBe(true);
    });

    it("storefront consumers can safely access images[0].src on any synthesised product", () => {
      const product = synthesiseProductFromRow(
        makeDbRow({ slug: "no-photos", sku: null, badges: [], offerTiers: [] }),
      );
      expect(() => {
        const src: string = product.images[0]!.src;
        expect(src.length).toBeGreaterThan(0);
      }).not.toThrow();
    });

    it("resolves a bare R2 object key to the public CDN URL", () => {
      const product = synthesiseProductFromRow(
        makeDbRow({ heroImageUrl: "studio-intake/fanaa/01KSV1FECA3CBA81WX72TYDHD6.png" }),
      );
      expect(product.images[0]!.src).toBe(
        "https://cdn.elfanaa.com/studio-intake/fanaa/01KSV1FECA3CBA81WX72TYDHD6.png",
      );
    });

    it("resolves an r2:// ref (strips scheme + bucket) to the public CDN URL", () => {
      const product = synthesiseProductFromRow(
        makeDbRow({ heroImageUrl: "r2://fanaa-bucket/studio/abc/gen.webp" }),
      );
      expect(product.images[0]!.src).toBe("https://cdn.elfanaa.com/studio/abc/gen.webp");
    });

    it("passes an absolute http(s) URL through untouched", () => {
      const product = synthesiseProductFromRow(
        makeDbRow({ heroImageUrl: "https://cdn.elfanaa.com/already/absolute.png" }),
      );
      expect(product.images[0]!.src).toBe("https://cdn.elfanaa.com/already/absolute.png");
    });

    it("rewrites a private R2 S3-endpoint URL to the public CDN (drops bucket)", () => {
      const product = synthesiseProductFromRow(
        makeDbRow({
          heroImageUrl:
            "https://7f605bacfe3b2fe3200beac2dbe29337.r2.cloudflarestorage.com/fanaa-assets/studio/draft1/generated/abc.jpg",
        }),
      );
      expect(product.images[0]!.src).toBe(
        "https://cdn.elfanaa.com/studio/draft1/generated/abc.jpg",
      );
    });

    it("falls back to the placeholder for an unknown scheme", () => {
      const product = synthesiseProductFromRow(
        makeDbRow({ heroImageUrl: "blob:something-unservable" }),
      );
      expect(product.images[0]).toEqual(PLACEHOLDER_PRODUCT_IMAGE);
    });
  });

  it("falls back title/description to the slug", () => {
    const row = makeDbRow({ slug: "ai-product" });
    const product = synthesiseProductFromRow(row);
    expect(product.title).toEqual({ ar: "ai-product", en: "ai-product" });
    expect(product.description).toEqual({ ar: "", en: "" });
  });

  describe("price sanitisation", () => {
    it("clamps NaN priceMinor to 0 and warns", () => {
      const row = makeDbRow({ priceMinor: Number.NaN });
      const product = synthesiseProductFromRow(row);
      expect(product.price.amount).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("invalid priceMinor"),
        expect.objectContaining({ slug: row.slug }),
      );
    });

    it("clamps negative priceMinor to 0 and warns", () => {
      const row = makeDbRow({ priceMinor: -500 });
      const product = synthesiseProductFromRow(row);
      expect(product.price.amount).toBe(0);
      expect(warnSpy).toHaveBeenCalled();
    });

    it("clamps Infinity priceMinor to 0 and warns", () => {
      const row = makeDbRow({ priceMinor: Number.POSITIVE_INFINITY });
      const product = synthesiseProductFromRow(row);
      expect(product.price.amount).toBe(0);
      expect(warnSpy).toHaveBeenCalled();
    });

    it("falls back empty priceCurrency to 'SAR' and warns", () => {
      const row = makeDbRow({ priceCurrency: "" });
      const product = synthesiseProductFromRow(row);
      expect(product.price.currency).toBe("SAR");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("missing priceCurrency"),
        expect.objectContaining({ slug: row.slug }),
      );
    });

    it("falls back whitespace-only priceCurrency to 'SAR'", () => {
      const row = makeDbRow({ priceCurrency: "   " });
      const product = synthesiseProductFromRow(row);
      expect(product.price.currency).toBe("SAR");
    });

    it("preserves a normal positive priceMinor", () => {
      const row = makeDbRow({ priceMinor: 99900, priceCurrency: "AED" });
      const product = synthesiseProductFromRow(row);
      expect(product.price).toEqual({ amount: 99900, currency: "AED" });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("preserves zero priceMinor (already valid)", () => {
      const row = makeDbRow({ priceMinor: 0 });
      const product = synthesiseProductFromRow(row);
      expect(product.price.amount).toBe(0);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("closed-enum validation", () => {
    it("keeps valid productType", () => {
      const product = synthesiseProductFromRow(
        makeDbRow({ productType: "serum" }),
      );
      expect(product.productType).toBe("serum");
    });

    it("drops unknown productType and warns", () => {
      const product = synthesiseProductFromRow(
        makeDbRow({ productType: "elixir-bottle" }),
      );
      expect(product.productType).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("unknown productType"),
        expect.objectContaining({ value: "elixir-bottle" }),
      );
    });

    it("keeps valid target", () => {
      const product = synthesiseProductFromRow(
        makeDbRow({ target: "unisex" }),
      );
      expect(product.target).toBe("unisex");
    });

    it("drops unknown target and warns", () => {
      const product = synthesiseProductFromRow(
        makeDbRow({ target: "everyone" }),
      );
      expect(product.target).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("unknown target"),
        expect.objectContaining({ value: "everyone" }),
      );
    });

    it("keeps valid problems and filters unknown ones", () => {
      const product = synthesiseProductFromRow(
        makeDbRow({
          problems: ["dark-spots", "made-up-issue", "dryness"],
        }),
      );
      expect(product.problems).toEqual(["dark-spots", "dryness"]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("unknown problem values"),
        expect.objectContaining({ dropped: ["made-up-issue"] }),
      );
    });

    it("returns undefined when all problem values are unknown", () => {
      const product = synthesiseProductFromRow(
        makeDbRow({ problems: ["fake-one", "fake-two"] }),
      );
      expect(product.problems).toBeUndefined();
    });

    it("returns undefined when problems array is empty", () => {
      const product = synthesiseProductFromRow(
        makeDbRow({ problems: [] }),
      );
      expect(product.problems).toBeUndefined();
    });
  });

  describe("JSON-column coercion in synthesise path", () => {
    it("returns undefined offerTiers when DB value is corrupt", () => {
      const product = synthesiseProductFromRow(
        makeDbRow({
          offerTiers: [{ quantity: "two", total: "lol" }],
        }),
      );
      expect(product.offerTiers).toBeUndefined();
    });

    it("returns undefined offerTiers when DB value is empty array", () => {
      const product = synthesiseProductFromRow(
        makeDbRow({ offerTiers: [] }),
      );
      expect(product.offerTiers).toBeUndefined();
    });

    it("returns valid offerTiers when DB value is well-formed", () => {
      const product = synthesiseProductFromRow(
        makeDbRow({
          offerTiers: [
            { quantity: 1, total: { amount: 9900, currency: "SAR" } },
          ],
        }),
      );
      expect(product.offerTiers).toEqual([
        { quantity: 1, total: { amount: 9900, currency: "SAR" } },
      ]);
    });

    it("returns undefined badges when DB value is empty", () => {
      const product = synthesiseProductFromRow(makeDbRow({ badges: [] }));
      expect(product.badges).toBeUndefined();
    });

    it("returns undefined rating when DB value is null", () => {
      const product = synthesiseProductFromRow(makeDbRow({ rating: null }));
      expect(product.rating).toBeUndefined();
    });
  });

  describe("scalar passthrough", () => {
    it("passes through sku, collection, upsellIds, stockLeft, recentBuyers, landingPath", () => {
      const product = synthesiseProductFromRow(
        makeDbRow({
          sku: "FN-X-001",
          collection: "routine",
          upsellIds: ["p_002", "p_003"],
          stockLeft: 12,
          recentBuyers: 47,
          landingPath: "/ai-product",
        }),
      );
      expect(product.sku).toBe("FN-X-001");
      expect(product.collection).toBe("routine");
      expect(product.upsellIds).toEqual(["p_002", "p_003"]);
      expect(product.stockLeft).toBe(12);
      expect(product.recentBuyers).toBe(47);
      expect(product.landingPath).toBe("/ai-product");
    });

    it("returns undefined for null scalars", () => {
      const product = synthesiseProductFromRow(
        makeDbRow({
          sku: null,
          collection: null,
          stockLeft: null,
          recentBuyers: null,
          landingPath: null,
        }),
      );
      expect(product.sku).toBeUndefined();
      expect(product.collection).toBeUndefined();
      expect(product.stockLeft).toBeUndefined();
      expect(product.recentBuyers).toBeUndefined();
      expect(product.landingPath).toBeUndefined();
    });

    it("returns undefined for empty upsellIds", () => {
      const product = synthesiseProductFromRow(makeDbRow({ upsellIds: [] }));
      expect(product.upsellIds).toBeUndefined();
    });
  });
});

/* -------------------------------------------------------------------------- */
/*                          assembleCatalogProducts                            */
/* -------------------------------------------------------------------------- */

describe("assembleCatalogProducts", () => {
  it("returns empty array on empty snapshot + empty map", () => {
    const result = assembleCatalogProducts([], new Map());
    expect(result).toEqual([]);
  });

  it("returns snapshot products unchanged when DB map is empty", () => {
    const snapshot = [
      makeSnapshotProduct({ id: "p_001", slug: "glow-serum" }),
      makeSnapshotProduct({ id: "p_002", slug: "barrier-cream" }),
    ];
    const result = assembleCatalogProducts(snapshot, new Map());
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("p_001");
    expect(result[1]?.id).toBe("p_002");
  });

  it("preserves snapshot declaration order (NOT alphabetical / updatedAt)", () => {
    const snapshot = [
      makeSnapshotProduct({ id: "p_003", slug: "ritual-c" }),
      makeSnapshotProduct({ id: "p_001", slug: "ritual-a" }),
      makeSnapshotProduct({ id: "p_002", slug: "ritual-b" }),
    ];
    const result = assembleCatalogProducts(snapshot, new Map());
    expect(result.map((p) => p.slug)).toEqual([
      "ritual-c",
      "ritual-a",
      "ritual-b",
    ]);
  });

  it("overlays DB rows onto matching snapshot products without duplicating them", () => {
    const snapshot = [
      makeSnapshotProduct({ id: "p_001", slug: "glow-serum", sku: "SS-1" }),
      makeSnapshotProduct({ id: "p_002", slug: "barrier-cream", sku: "SS-2" }),
    ];
    const map = new Map<string, CatalogRow>([
      ["glow-serum", makeDbRow({ slug: "glow-serum", sku: "DB-1" })],
    ]);
    const result = assembleCatalogProducts(snapshot, map);
    expect(result).toHaveLength(2);
    expect(result[0]?.sku).toBe("DB-1");
    expect(result[1]?.sku).toBe("SS-2");
  });

  it("synthesises DB-only rows that have no snapshot match, appended after snapshot products", () => {
    const snapshot = [
      makeSnapshotProduct({ id: "p_001", slug: "glow-serum" }),
    ];
    const map = new Map<string, CatalogRow>([
      [
        "ai-generated-1",
        makeDbRow({
          id: "row_new_1",
          slug: "ai-generated-1",
          source: "ai_generated",
          priceMinor: 24900,
          priceCurrency: "SAR",
        }),
      ],
    ]);
    const result = assembleCatalogProducts(snapshot, map);
    expect(result).toHaveLength(2);
    expect(result[0]?.slug).toBe("glow-serum");
    expect(result[1]?.slug).toBe("ai-generated-1");
    expect(result[1]?.price).toEqual({ amount: 24900, currency: "SAR" });
  });

  it("never duplicates a slug that exists in both snapshot AND db-only iteration", () => {
    const snapshot = [
      makeSnapshotProduct({ id: "p_001", slug: "glow-serum" }),
    ];
    const map = new Map<string, CatalogRow>([
      ["glow-serum", makeDbRow({ slug: "glow-serum", sku: "DB-1" })],
    ]);
    const result = assembleCatalogProducts(snapshot, map);
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("glow-serum");
    expect(result[0]?.sku).toBe("DB-1");
  });

  it("preserves map iteration order for DB-only rows", () => {
    const snapshot: Product[] = [];
    const map = new Map<string, CatalogRow>();
    map.set(
      "newest",
      makeDbRow({ slug: "newest", priceMinor: 30000, priceCurrency: "SAR" }),
    );
    map.set(
      "middle",
      makeDbRow({ slug: "middle", priceMinor: 20000, priceCurrency: "SAR" }),
    );
    map.set(
      "oldest",
      makeDbRow({ slug: "oldest", priceMinor: 10000, priceCurrency: "SAR" }),
    );
    const result = assembleCatalogProducts(snapshot, map);
    expect(result.map((p) => p.slug)).toEqual(["newest", "middle", "oldest"]);
  });

  it("works correctly with the full curated + ai-generated mix scenario", () => {
    const snapshot = [
      makeSnapshotProduct({ id: "p_001", slug: "glow-serum" }),
      makeSnapshotProduct({ id: "p_002", slug: "barrier-cream" }),
    ];
    const map = new Map<string, CatalogRow>();
    map.set(
      "glow-serum",
      makeDbRow({ slug: "glow-serum", sku: "DB-OVERLAY-1" }),
    );
    map.set(
      "new-mask",
      makeDbRow({
        slug: "new-mask",
        source: "ai_generated",
        productType: "mask",
      }),
    );
    map.set(
      "barrier-cream",
      makeDbRow({ slug: "barrier-cream", sku: "DB-OVERLAY-2" }),
    );

    const result = assembleCatalogProducts(snapshot, map);
    expect(result).toHaveLength(3);
    expect(result[0]?.slug).toBe("glow-serum");
    expect(result[0]?.sku).toBe("DB-OVERLAY-1");
    expect(result[1]?.slug).toBe("barrier-cream");
    expect(result[1]?.sku).toBe("DB-OVERLAY-2");
    expect(result[2]?.slug).toBe("new-mask");
    expect(result[2]?.productType).toBe("mask");
  });
});

/* -------------------------------------------------------------------------- */
/*              cro_content hydration (Step 4 / Phase 4.2 data path)           */
/* -------------------------------------------------------------------------- */

describe("synthesiseProductFromRow — cro_content projection", () => {
  const richCro = {
    headline: { ar: "عنوان", en: "Headline" },
    subheadline: { ar: "عنوان فرعي", en: "Subheadline" },
    foundersNote: { ar: "ملاحظة", en: "Founder note" },
    benefits: [
      { icon: "Shield", title: { ar: "ميزة", en: "Benefit" }, body: { ar: "وصف", en: "Body" } },
    ],
    reviews: [
      {
        name: { ar: "سارة", en: "Sara" },
        city: { ar: "الرياض", en: "Riyadh" },
        rating: 5,
        body: { ar: "رائع", en: "Great" },
        date: "2026-05-01",
        verified: true,
      },
    ],
    faq: [{ q: { ar: "سؤال", en: "Q" }, a: { ar: "جواب", en: "A" } }],
    ingredients: [{ name: { ar: "عسل", en: "Honey" }, role: { ar: "ترطيب", en: "Hydrates" } }],
    sectionContent: {
      howItWorks: {
        summary: { ar: "ملخص", en: "Summary" },
        steps: [{ title: { ar: "خطوة", en: "Step" }, body: { ar: "تفاصيل", en: "Detail" } }],
      },
      guarantee: { title: { ar: "ضمان", en: "Guarantee" }, body: { ar: "نص", en: "Body" } },
      comparison: {
        ours: [{ ar: "ميزة", en: "Ours" }],
        usual: [{ ar: "عيب", en: "Theirs" }],
      },
      objections: {
        items: [{ objection: { ar: "اعتراض", en: "Doubt" }, response: { ar: "رد", en: "Reply" } }],
      },
      results: {
        timeline: [{ when: { ar: "أسبوع", en: "Week 1" }, outcome: { ar: "نتيجة", en: "Result" } }],
      },
    },
    sectionOrder: ["how_it_works", "benefits", "faq"],
  };

  it("hydrates the rich CRO surface onto a synthesised AI product", () => {
    const product = synthesiseProductFromRow(
      makeDbRow({ slug: "ai-rich", source: "ai_generated", croContent: richCro }),
    );
    expect(product.headline).toEqual({ ar: "عنوان", en: "Headline" });
    expect(product.foundersNote).toEqual({ ar: "ملاحظة", en: "Founder note" });
    expect(product.benefits).toHaveLength(1);
    expect(product.reviews).toHaveLength(1);
    expect(product.faq).toHaveLength(1);
    expect(product.ingredients).toHaveLength(1);
    expect(product.sectionContent?.howItWorks?.steps).toHaveLength(1);
    expect(product.sectionContent?.guarantee?.title.en).toBe("Guarantee");
    expect(product.sectionContent?.comparison?.ours).toHaveLength(1);
    expect(product.sectionContent?.objections?.items).toHaveLength(1);
    expect(product.sectionContent?.results?.timeline).toHaveLength(1);
    expect(product.sectionOrder).toEqual(["how_it_works", "benefits", "faq"]);
  });

  it("preserves the hero image as images[0] and appends projected gallery images", () => {
    const product = synthesiseProductFromRow(
      makeDbRow({
        slug: "ai-gallery",
        heroImageUrl: "https://cdn.elfanaa.com/hero.png",
        croContent: {
          images: [
            { src: "https://cdn.elfanaa.com/hero.png", alt: { ar: "ب", en: "hero" } },
            { src: "https://cdn.elfanaa.com/gallery-2.png", alt: { ar: "ب", en: "g2" } },
          ],
        },
      }),
    );
    expect(product.images[0]!.src).toBe("https://cdn.elfanaa.com/hero.png");
    expect(product.images[1]!.src).toBe("https://cdn.elfanaa.com/gallery-2.png");
  });

  it("ignores a malformed cro_content blob and stays renderable (commerce-only)", () => {
    const product = synthesiseProductFromRow(
      makeDbRow({
        slug: "ai-broken",
        croContent: { headline: "not-a-localized-string", benefits: [{ junk: true }] },
      }),
    );
    expect(product.slug).toBe("ai-broken");
    // Malformed localized field is dropped, not coerced into a crash.
    expect(product.headline).toBeUndefined();
  });

  it("leaves curated rows (null cro_content) untouched", () => {
    const product = synthesiseProductFromRow(makeDbRow({ croContent: null }));
    expect(product.foundersNote).toBeUndefined();
    expect(product.sectionContent).toBeUndefined();
    expect(product.sectionOrder).toBeUndefined();
  });
});
