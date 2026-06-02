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
    // Phase 4.6.4a — benefits is now an image-capable creative section.
    expect(a.benefits).toBeDefined();
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

/**
 * Phase 4.6.3 — semantic matching. A scene's `intent` decides its section: the
 * RIGHT scene for the RIGHT section, with a positional fallback so the page
 * stays image-led when intents don't cover every section.
 */
function scene(intent: string, tag = intent): ProductImage {
  return { src: `https://cdn.elfanaa.com/${tag}.png`, alt: { ar: "", en: "" }, intent };
}

describe("assignSectionImages (Phase 4.6.3 semantic matching)", () => {
  it("routes each intent to its matching section regardless of pool order", () => {
    const p = product({
      lifestyleImages: [
        scene("proof"),
        scene("ingredient"),
        scene("mechanism"),
        scene("result"),
        scene("context"),
      ],
    });
    const a = assignSectionImages(p, FULL_ORDER);
    expect(a.social_proof?.src).toContain("proof");
    expect(a.ingredients?.src).toContain("ingredient");
    expect(a.how_it_works?.src).toContain("mechanism");
    expect(a.results?.src).toContain("result");
    expect(a.lifestyle?.src).toContain("context");
  });

  it("matches tolerantly on synonyms (before-after / transformation → results)", () => {
    expect(
      assignSectionImages(product({ lifestyleImages: [scene("before-after")] }), FULL_ORDER)
        .results?.src,
    ).toContain("before-after");
    expect(
      assignSectionImages(product({ lifestyleImages: [scene("transformation")] }), FULL_ORDER)
        .results?.src,
    ).toContain("transformation");
  });

  it("semantic first, then positional fallback for unmatched sections", () => {
    // One semantic 'result' scene + two intent-less scenes.
    const p = product({
      lifestyleImages: [scene("result"), img(1), img(2)],
    });
    const a = assignSectionImages(p, FULL_ORDER);
    // 'result' goes semantically to results (not positionally to lifestyle).
    expect(a.results?.src).toContain("result");
    // The two plain scenes backfill the top positional priorities (lifestyle,
    // how_it_works) and are distinct.
    expect(a.lifestyle?.src).toMatch(/scene-[12]/);
    expect(a.how_it_works?.src).toMatch(/scene-[12]/);
    const used = Object.values(a).map((i) => i.src);
    expect(new Set(used).size).toBe(used.length);
  });

  it("does not reuse a scene across semantic + positional passes", () => {
    const p = product({ lifestyleImages: [scene("result"), scene("proof")] });
    const a = assignSectionImages(p, FULL_ORDER);
    const used = Object.values(a).map((i) => i.src);
    expect(new Set(used).size).toBe(used.length);
    expect(used).toHaveLength(2);
  });
});
