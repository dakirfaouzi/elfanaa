import { describe, expect, it } from "vitest";
import { fanaaStore } from "@platform/stores";
import { imagePost } from "../image-post";
import type { CopyOutput } from "../types-copy";
import type {
  ImageGenOutput,
} from "../types-image-gen";

const dummyCopy: CopyOutput = {
  title: { ar: "سيروم", en: "Serum" },
  headline: { ar: "إشراق يومي.", en: "Daily glow." },
  description: { ar: "وصف.", en: "Desc." },
  benefits: [
    {
      icon: "Sparkles",
      title: { ar: "ا", en: "x" },
      body: { ar: "ا", en: "x" },
    },
  ],
};

describe("image-post (stage 09)", () => {
  it("splits results into hero / gallery / lifestyle correctly", async () => {
    const imageGen: ImageGenOutput = {
      results: [
        {
          role: "hero",
          prompt: "p",
          url: "https://cdn/hero.webp",
          width: 1024,
          height: 1024,
          costUsd: 0,
          model: "m",
          providerId: "fal",
          attempts: 1,
        },
        {
          role: "lifestyle",
          intent: "morning",
          prompt: "p2",
          url: "https://cdn/lifestyle.webp",
          width: 1024,
          height: 1280,
          costUsd: 0,
          model: "m",
          providerId: "fal",
          attempts: 1,
        },
      ],
      failed: [],
      totalCostUsd: 0,
    };

    const out = await imagePost({
      input: { imageGen, copy: dummyCopy },
      storeConfig: fanaaStore,
      runId: "run_test_image_post_1",
    });

    expect(out.hero?.src).toBe("https://cdn/hero.webp");
    expect(out.hero?.width).toBe(1024);
    expect(out.lifestyle).toHaveLength(1);
    expect(out.gallery).toHaveLength(0);
    expect(out.postProcessed).toBe(false);
  });

  it("produces bilingual alt text from the copy headline + image intent", async () => {
    const imageGen: ImageGenOutput = {
      results: [
        {
          role: "hero",
          prompt: "p",
          url: "https://cdn/hero.webp",
          width: 1024,
          height: 1024,
          costUsd: 0,
          model: "m",
          providerId: "fal",
          attempts: 1,
        },
        {
          role: "lifestyle",
          intent: "evening_ritual",
          prompt: "p2",
          url: "https://cdn/lifestyle.webp",
          width: 1024,
          height: 1280,
          costUsd: 0,
          model: "m",
          providerId: "fal",
          attempts: 1,
        },
      ],
      failed: [],
      totalCostUsd: 0,
    };

    const out = await imagePost({
      input: { imageGen, copy: dummyCopy },
      storeConfig: fanaaStore,
      runId: "run_test_image_post_2",
    });

    expect(out.hero?.alt.ar).toContain("إشراق يومي");
    expect(out.hero?.alt.en).toContain("Daily glow");
    expect(out.lifestyle[0]?.alt.en).toContain("evening_ritual");
    // Phase 4.6.3 — the semantic intent is carried onto the ProcessedImage so
    // the storefront can assign the right scene to the right section.
    expect(out.lifestyle[0]?.intent).toBe("evening_ritual");
    expect(out.hero?.intent).toBeUndefined();
  });

  it("returns an undefined hero when no hero result exists (lifestyle-only)", async () => {
    const imageGen: ImageGenOutput = {
      results: [
        {
          role: "lifestyle",
          prompt: "p",
          url: "https://cdn/lifestyle.webp",
          width: 1024,
          height: 1280,
          costUsd: 0,
          model: "m",
          providerId: "fal",
          attempts: 1,
        },
      ],
      failed: [],
      totalCostUsd: 0,
    };

    const out = await imagePost({
      input: { imageGen, copy: dummyCopy },
      storeConfig: fanaaStore,
      runId: "run_test_image_post_3",
    });

    expect(out.hero).toBeUndefined();
    expect(out.lifestyle).toHaveLength(1);
  });
});
