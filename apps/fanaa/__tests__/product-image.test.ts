/**
 * Storefront image-helper tests (Phase 2.4.1 regression guard).
 *
 * These pin the second defensive layer of the missing-image fix
 * shipped in Phase 2.4.1 — `lib/product-image.ts` exports a small
 * helper API that every UI consumer used to access `images[0]` via
 * (ProductCard, cart drawer, PDP gallery, sticky bar, post-purchase
 * upsell, lifestyle band). Each helper must return a usable
 * `ProductImage` in three scenarios:
 *
 *   1. Happy path  — snapshot products with full curated photography.
 *   2. Synthesised path — AI-generated rows whose synthesiseProductFromRow
 *      already injected the placeholder (the layer-1 guarantee).
 *   3. Degraded path — a future regression hands the helper a Product
 *      with `images: []`. The helper still produces a renderable
 *      placeholder rather than letting the caller crash.
 */

import { describe, expect, it } from "vitest";
import type { Product, ProductImage } from "@/lib/types";
import {
  PLACEHOLDER_PRODUCT_IMAGE,
  getLifestyleImage,
  getPrimaryImage,
  getProductImageAt,
} from "@/lib/product-image";

const REAL_HERO: ProductImage = {
  src: "https://images.unsplash.com/photo-1.jpg",
  alt: { ar: "هيرو", en: "Hero" },
};

const REAL_SECONDARY: ProductImage = {
  src: "https://images.unsplash.com/photo-2.jpg",
  alt: { ar: "ثانوي", en: "Secondary" },
};

const REAL_LIFESTYLE: ProductImage = {
  src: "https://images.unsplash.com/photo-lifestyle.jpg",
  alt: { ar: "نمط حياة", en: "Lifestyle" },
};

function productWith(images: ProductImage[], lifestyleImage?: ProductImage): Product {
  return {
    id: "p_test",
    slug: "test",
    title: { ar: "", en: "Test" },
    description: { ar: "", en: "" },
    images,
    price: { amount: 19900, currency: "SAR" },
    ...(lifestyleImage ? { lifestyleImage } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/*                          PLACEHOLDER_PRODUCT_IMAGE                          */
/* -------------------------------------------------------------------------- */

describe("PLACEHOLDER_PRODUCT_IMAGE", () => {
  it("uses an inline data URL (no network fetch, no /public copy, no _next/image hop)", () => {
    // Phase 2.4.3 migration: the placeholder is now inlined as a
    // `data:image/svg+xml` URL. This is the contract every consumer
    // relies on — next/image auto-bypasses the optimizer for `data:`
    // srcs, so the placeholder renders without depending on
    // `next.config.mjs::images.dangerouslyAllowSVG`, the
    // `/_next/image` optimizer, or the `public/` folder being copied
    // into the standalone Docker bundle.
    expect(PLACEHOLDER_PRODUCT_IMAGE.src.startsWith("data:image/svg+xml")).toBe(true);
  });

  it("ships bilingual alt text (ar + en)", () => {
    expect(PLACEHOLDER_PRODUCT_IMAGE.alt.ar.length).toBeGreaterThan(0);
    expect(PLACEHOLDER_PRODUCT_IMAGE.alt.en.length).toBeGreaterThan(0);
  });

  it("encodes a valid SVG document (round-trips through decodeURIComponent)", () => {
    // The placeholder is URL-encoded (not base64) to stay
    // human-diffable. The encoded payload must still decode to a
    // well-formed SVG so the browser can render it.
    const commaIdx = PLACEHOLDER_PRODUCT_IMAGE.src.indexOf(",");
    expect(commaIdx).toBeGreaterThan(0);
    const decoded = decodeURIComponent(
      PLACEHOLDER_PRODUCT_IMAGE.src.slice(commaIdx + 1),
    );
    expect(decoded).toMatch(/^<svg\s/);
    expect(decoded).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(decoded).toContain("</svg>");
    // Sanity-check that the brand palette and caption survived the
    // encode/decode round-trip — guards against a future edit
    // accidentally truncating the markup string.
    expect(decoded).toContain("#F5EFE6");
    expect(decoded).toContain("image pending");
  });

  it("stays well under typical browser URL length limits (<8KB)", () => {
    // 8KB is the practical safe ceiling for data URLs across all
    // major browsers and CDN edge layers. The placeholder is ~1KB,
    // so this is a regression guard against someone pasting in a
    // photographic SVG by accident.
    expect(PLACEHOLDER_PRODUCT_IMAGE.src.length).toBeLessThan(8 * 1024);
  });
});

/* -------------------------------------------------------------------------- */
/*                               getPrimaryImage                               */
/* -------------------------------------------------------------------------- */

describe("getPrimaryImage", () => {
  it("returns images[0] when the product has photography", () => {
    expect(getPrimaryImage(productWith([REAL_HERO, REAL_SECONDARY]))).toBe(REAL_HERO);
  });

  it("returns images[0] even when it's the only image", () => {
    expect(getPrimaryImage(productWith([REAL_HERO]))).toBe(REAL_HERO);
  });

  it("returns the placeholder when images is empty", () => {
    expect(getPrimaryImage(productWith([]))).toBe(PLACEHOLDER_PRODUCT_IMAGE);
  });

  it("never returns undefined regardless of input", () => {
    const result = getPrimaryImage(productWith([]));
    expect(result).not.toBeUndefined();
    expect(typeof result.src).toBe("string");
  });

  it("returns the placeholder when images is undefined (legacy / malformed product)", () => {
    // TypeScript declares `images: ProductImage[]` non-optional, but
    // legacy persisted carts, malformed DB rows, or test fixtures can
    // still hand us `{ images: undefined }`. The helper must NOT
    // crash with "Cannot read properties of undefined (reading '0')"
    // — the regression-trigger that took down /thank-you in Phase
    // 2.4.1's first hotfix attempt.
    const malformed = { images: undefined as unknown as ProductImage[] };
    expect(getPrimaryImage(malformed)).toBe(PLACEHOLDER_PRODUCT_IMAGE);
  });
});

/* -------------------------------------------------------------------------- */
/*                              getProductImageAt                              */
/* -------------------------------------------------------------------------- */

describe("getProductImageAt", () => {
  it("returns images[index] when the index is in range", () => {
    expect(
      getProductImageAt(productWith([REAL_HERO, REAL_SECONDARY]), 1),
    ).toBe(REAL_SECONDARY);
  });

  it("falls back to images[0] when the requested index is out of range", () => {
    expect(getProductImageAt(productWith([REAL_HERO]), 3)).toBe(REAL_HERO);
  });

  it("falls back to the placeholder when both index and primary are missing", () => {
    expect(getProductImageAt(productWith([]), 0)).toBe(PLACEHOLDER_PRODUCT_IMAGE);
  });

  it("handles negative indices gracefully (returns primary or placeholder)", () => {
    // JS array access with a negative index returns undefined — the
    // helper must still degrade gracefully rather than crash.
    expect(getProductImageAt(productWith([REAL_HERO]), -1)).toBe(REAL_HERO);
    expect(getProductImageAt(productWith([]), -1)).toBe(PLACEHOLDER_PRODUCT_IMAGE);
  });

  it("preserves stable identity (no defensive cloning)", () => {
    const product = productWith([REAL_HERO, REAL_SECONDARY]);
    expect(getProductImageAt(product, 0)).toBe(REAL_HERO);
    expect(getProductImageAt(product, 1)).toBe(REAL_SECONDARY);
  });

  it("returns the placeholder when images is undefined (legacy / malformed product)", () => {
    const malformed = { images: undefined as unknown as ProductImage[] };
    expect(getProductImageAt(malformed, 0)).toBe(PLACEHOLDER_PRODUCT_IMAGE);
    expect(getProductImageAt(malformed, 5)).toBe(PLACEHOLDER_PRODUCT_IMAGE);
  });
});

/* -------------------------------------------------------------------------- */
/*                              getLifestyleImage                              */
/* -------------------------------------------------------------------------- */

describe("getLifestyleImage", () => {
  it("returns lifestyleImage when set", () => {
    expect(
      getLifestyleImage(productWith([REAL_HERO], REAL_LIFESTYLE)),
    ).toBe(REAL_LIFESTYLE);
  });

  it("falls back to images[0] when lifestyleImage is undefined", () => {
    expect(getLifestyleImage(productWith([REAL_HERO]))).toBe(REAL_HERO);
  });

  it("falls back to the placeholder when both lifestyleImage and images[0] are missing", () => {
    expect(getLifestyleImage(productWith([]))).toBe(PLACEHOLDER_PRODUCT_IMAGE);
  });

  it("prefers lifestyleImage even when images[0] is also set", () => {
    // The PDP lifestyle band specifically wants the aspirational
    // photo, not the product cut-out — never let the gallery hero
    // shadow the lifestyle image when both exist.
    expect(
      getLifestyleImage(productWith([REAL_HERO, REAL_SECONDARY], REAL_LIFESTYLE)),
    ).toBe(REAL_LIFESTYLE);
  });

  it("falls through to the placeholder when images is undefined and lifestyleImage is missing", () => {
    const malformed = {
      images: undefined as unknown as ProductImage[],
      lifestyleImage: undefined,
    };
    expect(getLifestyleImage(malformed)).toBe(PLACEHOLDER_PRODUCT_IMAGE);
  });
});
