import { describe, expect, it } from "vitest";
import { fanaaStore } from "@platform/stores";
import { assemble } from "../assemble";
import { PipelineError } from "../types";
import type { AssembleInput } from "../types-assemble";

const baseInput: AssembleInput = {
  research: {
    supplierUrl: "https://supplier.example/product/123",
    scrapedAt: "2026-01-01T00:00:00.000Z",
    skipped: false,
    title: "supplier title",
    markdown: "# md",
    costUsd: 0.01,
    durationMs: 100,
  },
  vision: {
    skipped: false,
    productCategory: "face serum",
    costUsd: 0.005,
  },
  strategy: {
    heroPromise: { ar: "إشراق.", en: "Glow." },
    persona: { ar: "ا", en: "a" },
    benefitAngles: [
      { label: "tone", title: { ar: "ا", en: "Tone" }, body: { ar: "ا", en: "x" } },
      { label: "glow", title: { ar: "ا", en: "Glow" }, body: { ar: "ا", en: "x" } },
      { label: "hydration", title: { ar: "ا", en: "Hydration" }, body: { ar: "ا", en: "x" } },
    ],
    objections: [
      { objection: { ar: "ا", en: "o" }, neutraliser: { ar: "ا", en: "n" } },
      { objection: { ar: "ا", en: "o" }, neutraliser: { ar: "ا", en: "n" } },
    ],
    adAngles: ["emotional", "story", "authority"],
  },
  structure: {
    templateId: "fanaa.generic_pdp",
    sections: ["hero", "benefits"],
    custom: false,
    usedFallback: false,
  },
  copy: {
    title: { ar: "سيروم النور", en: "Glow Serum" },
    headline: { ar: "إشراق يومي.", en: "Daily glow." },
    description: {
      ar: "سيروم خفيف لإشراق طبيعي.",
      en: "A lightweight serum for natural glow.",
    },
    benefits: [
      {
        icon: "Sparkles",
        title: { ar: "إشراق", en: "Glow" },
        body: { ar: "ا", en: "x" },
      },
      {
        icon: "Droplet",
        title: { ar: "ترطيب", en: "Hydration" },
        body: { ar: "ا", en: "x" },
      },
      {
        icon: "Shield",
        title: { ar: "حماية", en: "Protection" },
        body: { ar: "ا", en: "x" },
      },
    ],
  },
  prompts: {
    hero: { prompt: "p", aspectRatio: "1:1" },
    lifestyle: [],
  },
  imageGen: {
    results: [],
    failed: [],
    totalCostUsd: 0,
  },
  imagePost: {
    hero: {
      src: "https://cdn.mock/hero.webp",
      alt: { ar: "صورة", en: "image" },
      width: 1024,
      height: 1024,
    },
    gallery: [],
    lifestyle: [
      {
        src: "https://cdn.mock/lifestyle-1.webp",
        alt: { ar: "صورة", en: "image" },
        width: 1024,
        height: 1280,
      },
    ],
    postProcessed: false,
  },
  socialProof: {
    reviews: [
      {
        name: { ar: "نورة", en: "Noura" },
        city: { ar: "الرياض", en: "Riyadh" },
        rating: 5,
        body: { ar: "ا", en: "Great" },
        date: "2025-12-01",
      },
    ],
    faq: [
      { q: { ar: "ا", en: "q" }, a: { ar: "ا", en: "a" } },
    ],
    hooks: [
      {
        angle: "emotional",
        body: { ar: "ا", en: "Body" },
        cta: { ar: "ا", en: "Shop" },
      },
    ],
  },
  upsells: {
    suggestedProductIds: ["up_a", "up_b"],
    source: "vector",
    durationMs: 12,
  },
  priceHint: { amount: 199, currency: "SAR" },
  uploadedImageKeys: ["stores/fanaa/runs/run_x/img/01.webp"],
  marginNotes: "supplier $4.20 + ship $1.80",
};

describe("assemble (stage 12)", () => {
  it("builds a UniversalProduct that passes the canonical Zod schema", async () => {
    const product = await assemble({
      input: baseInput,
      storeConfig: fanaaStore,
      runId: "run_assemble_1",
    });

    expect(product.id).toBe("up_run_assemble_1");
    expect(product.slug).toBe("glow-serum");
    expect(product.title.en).toBe("Glow Serum");
    expect(product.images[0]?.src).toBe("https://cdn.mock/hero.webp");
    expect(product.niche).toBe(fanaaStore.niche);
    expect(product.storeContext).toBe(fanaaStore.id);
    expect(product.generationRunId).toBe("run_assemble_1");
    expect(product.upsellSuggestions).toEqual(["up_a", "up_b"]);
    expect(product.sources.supplierUrl).toBe(
      baseInput.research.supplierUrl,
    );
    expect(product.sources.uploadedImages).toEqual(
      baseInput.uploadedImageKeys,
    );
  });

  it("carries the structure ordering and maps strategy objections even without a section_content input", async () => {
    const product = await assemble({
      input: baseInput,
      storeConfig: fanaaStore,
      runId: "run_assemble_order",
    });

    expect(product.sectionOrder).toEqual(["hero", "benefits"]);
    // Objections are reclaimed from the strategy stage (no extra LLM call).
    expect(product.sectionContent?.objections?.items).toHaveLength(2);
    // Blocks not generated remain absent (no placeholder sections).
    expect(product.sectionContent?.howItWorks).toBeUndefined();
    expect(product.ingredients).toBeUndefined();
  });

  it("distributes a section_content input into ingredients + rich sections", async () => {
    const input: AssembleInput = {
      ...baseInput,
      sectionContent: {
        howItWorks: {
          summary: { ar: "يرطب.", en: "Hydrates." },
          steps: [
            { title: { ar: "خطوة", en: "Step" }, body: { ar: "ا", en: "x" } },
            { title: { ar: "خطوة", en: "Step" }, body: { ar: "ا", en: "x" } },
          ],
        },
        ingredients: [
          {
            name: { ar: "حمض", en: "Acid" },
            role: { ar: "يرطب.", en: "Hydrates." },
          },
        ],
        guarantee: {
          title: { ar: "ضمان", en: "Guarantee" },
          body: { ar: "إرجاع.", en: "Returns." },
        },
      },
    };

    const product = await assemble({
      input,
      storeConfig: fanaaStore,
      runId: "run_assemble_rich",
    });

    expect(product.ingredients?.[0]?.name.en).toBe("Acid");
    expect(product.sectionContent?.howItWorks?.steps).toHaveLength(2);
    expect(product.sectionContent?.guarantee?.title.en).toBe("Guarantee");
    expect(product.sectionContent?.objections?.items).toHaveLength(2);
  });

  it("falls back to the operator-uploaded supplier image when image-gen produced no hero", async () => {
    const input: AssembleInput = {
      ...baseInput,
      imagePost: {
        hero: undefined,
        gallery: [],
        lifestyle: [],
        postProcessed: false,
      },
    };

    const product = await assemble({
      input,
      storeConfig: fanaaStore,
      runId: "run_assemble_2",
    });

    expect(product.images).toHaveLength(1);
    expect(product.images[0]?.src).toBe(
      "stores/fanaa/runs/run_x/img/01.webp",
    );
  });

  it("throws PipelineError when no image source is available at all", async () => {
    const input: AssembleInput = {
      ...baseInput,
      uploadedImageKeys: [],
      imagePost: {
        hero: undefined,
        gallery: [],
        lifestyle: [],
        postProcessed: false,
      },
    };

    await expect(
      assemble({
        input,
        storeConfig: fanaaStore,
        runId: "run_assemble_3",
      }),
    ).rejects.toBeInstanceOf(PipelineError);
  });

  it("omits upsellSuggestions when the upsell stage returned no IDs", async () => {
    const input: AssembleInput = {
      ...baseInput,
      upsells: { suggestedProductIds: [], source: "empty", durationMs: 0 },
    };

    const product = await assemble({
      input,
      storeConfig: fanaaStore,
      runId: "run_assemble_4",
    });

    expect(product.upsellSuggestions).toBeUndefined();
  });

  it("propagates lifestyleImages only when the image-post stage emitted some", async () => {
    const product = await assemble({
      input: baseInput,
      storeConfig: fanaaStore,
      runId: "run_assemble_5",
    });
    expect(product.lifestyleImages).toHaveLength(1);

    const without: AssembleInput = {
      ...baseInput,
      imagePost: { ...baseInput.imagePost, lifestyle: [] },
    };
    const without_product = await assemble({
      input: without,
      storeConfig: fanaaStore,
      runId: "run_assemble_6",
    });
    expect(without_product.lifestyleImages).toBeUndefined();
  });
});
