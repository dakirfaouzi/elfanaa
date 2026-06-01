import { describe, expect, it } from "vitest";
import { assignSectionImages } from "@/components/product/ProductSections";
import type { Product, ProductImage } from "@/lib/types";

/**
 * Phase 4.6.2 — image-led distribution. The generated scene pool must spread
 * across the highest-priority image-capable sections so the PDP reads image-led,
 * with later sections degrading to text-only when the pool runs out (no cheap
 * repetition).
 */

function img(n: number): ProductImage {
  return { src: `https://cdn.elfanaa.com/scene-${n}.png`, alt: { ar: `${n}`, en: `${n}` } };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p",
    slug: "p",
    title: { ar: "", en: "" },
    description: { ar: "", en: "" },
    images: [{ src: "https://cdn.elfanaa.com/hero.png", alt: { ar: "", en: "" } }],
    price: { amount: 1000, currency: "SAR" },
    ...overrides,
  } as Product;
}

const FULL_ORDER = [
  "benefits",
  "how_it_works",
  "ingredients",
  "results",
  "founders_note",
  "comparison",
  "lifestyle",
  "objections",
  "social_proof",
  "guarantee",
  "faq",
];

describe("assignSectionImages (Phase 4.6.2 distribution)", () => {
  it("assigns scenes to the highest-priority sections first, distinct per section", () => {
    const p = product({ lifestyleImages: [img(1), img(2), img(3)] });
    const a = assignSectionImages(p, FULL_ORDER);
    // Priority: lifestyle, how_it_works, results, comparison, ...
    expect(a.lifestyle?.src).toContain("scene-1");
    expect(a.how_it_works?.src).toContain("scene-2");
    expect(a.results?.src).toContain("scene-3");
    // Pool exhausted → lower priority sections get no image (text-only).
    expect(a.comparison).toBeUndefined();
    expect(a.faq).toBeUndefined();
    // No image is reused.
    const used = Object.values(a).map((i) => i.src);
    expect(new Set(used).size).toBe(used.length);
  });

  it("never assigns to FAQ (text-only) even with a large pool", () => {
    const p = product({ lifestyleImages: [img(1), img(2), img(3), img(4), img(5), img(6), img(7), img(8), img(9), img(10)] });
    const a = assignSectionImages(p, FULL_ORDER);
    expect(a.faq).toBeUndefined();
    expect(a.benefits).toBeUndefined(); // benefits not in IMAGE_PRIORITY
  });

  it("falls back to gallery (images minus hero) when no scene pool exists", () => {
    const p = product({
      images: [
        { src: "https://cdn.elfanaa.com/hero.png", alt: { ar: "", en: "" } },
        { src: "https://cdn.elfanaa.com/g2.png", alt: { ar: "", en: "" } },
      ],
    });
    const a = assignSectionImages(p, FULL_ORDER);
    expect(a.lifestyle?.src).toContain("g2.png");
  });

  it("returns no assignments when there are no images at all", () => {
    const p = product({ images: [] });
    expect(assignSectionImages(p, FULL_ORDER)).toEqual({});
  });

  it("only assigns to sections present in the render order", () => {
    const p = product({ lifestyleImages: [img(1), img(2)] });
    const a = assignSectionImages(p, ["how_it_works", "faq"]);
    // lifestyle isn't in the order → first scene goes to how_it_works.
    expect(a.how_it_works?.src).toContain("scene-1");
    expect(a.lifestyle).toBeUndefined();
  });
});
