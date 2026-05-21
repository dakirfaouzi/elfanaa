import { describe, expect, it } from "vitest";
import { fanaaStore } from "@platform/stores";
import { imageGen } from "../image-gen";
import type {
  CreativePromptsOutput,
} from "../types-creative-prompts";
import {
  imageResult,
  mockImage,
} from "./_helpers/mock-providers";

const promptsHeroOnly: CreativePromptsOutput = {
  hero: {
    prompt: "Studio product photograph of an amber glass dropper.",
    aspectRatio: "1:1",
  },
  lifestyle: [],
};

const promptsThree: CreativePromptsOutput = {
  hero: {
    prompt: "Studio product photograph of an amber glass dropper.",
    aspectRatio: "1:1",
  },
  lifestyle: [
    { prompt: "Lifestyle morning.", aspectRatio: "4:5", intent: "morning" },
    { prompt: "Lifestyle evening.", aspectRatio: "4:5", intent: "evening" },
  ],
};

describe("image-gen (stage 08)", () => {
  it("returns one result per prompt on the happy path", async () => {
    const img = mockImage({
      responses: [
        imageResult({ url: "https://cdn.mock/hero.webp" }),
        imageResult({
          url: "https://cdn.mock/lifestyle-1.webp",
          width: 1024,
          height: 1280,
        }),
        imageResult({
          url: "https://cdn.mock/lifestyle-2.webp",
          width: 1024,
          height: 1280,
        }),
      ],
    });

    const out = await imageGen({
      input: { prompts: promptsThree, maxAttemptsPerPrompt: 3 },
      providers: { image: img.provider },
      storeConfig: fanaaStore,
      runId: "run_test_image_gen_1",
    });

    expect(out.results).toHaveLength(3);
    expect(out.failed).toHaveLength(0);
    expect(out.results[0]?.role).toBe("hero");
    expect(out.totalCostUsd).toBeCloseTo(0.04 * 3, 2);
  });

  it("retries a failing prompt up to maxAttempts and accepts the eventual success", async () => {
    const img = mockImage({
      responses: [
        new Error("transient_a"),
        new Error("transient_b"),
        imageResult({ url: "https://cdn.mock/hero.webp" }),
      ],
    });

    const out = await imageGen({
      input: { prompts: promptsHeroOnly, maxAttemptsPerPrompt: 3 },
      providers: { image: img.provider },
      storeConfig: fanaaStore,
      runId: "run_test_image_gen_2",
    });

    expect(out.results).toHaveLength(1);
    expect(out.results[0]?.attempts).toBe(3);
    expect(out.failed).toHaveLength(0);
  });

  it("accepts partial success (some prompts fail, others succeed)", async () => {
    const img = mockImage({
      responses: [
        imageResult({ url: "https://cdn.mock/hero.webp" }),
        new Error("fail-1"),
        new Error("fail-1"),
        new Error("fail-1"),
        imageResult({
          url: "https://cdn.mock/lifestyle-2.webp",
          width: 1024,
          height: 1280,
        }),
      ],
    });

    const out = await imageGen({
      input: { prompts: promptsThree, maxAttemptsPerPrompt: 3 },
      providers: { image: img.provider },
      storeConfig: fanaaStore,
      runId: "run_test_image_gen_3",
    });

    expect(out.results).toHaveLength(2);
    expect(out.failed).toHaveLength(1);
    expect(out.failed[0]?.attempts).toBe(3);
    expect(out.failed[0]?.role).toBe("lifestyle");
  });

  it("uses the aspect-ratio mapping to size each call", async () => {
    const img = mockImage({
      responses: [
        imageResult({ width: 1024, height: 1024 }),
        imageResult({ width: 1024, height: 1280 }),
        imageResult({ width: 1024, height: 1280 }),
      ],
    });

    await imageGen({
      input: { prompts: promptsThree, maxAttemptsPerPrompt: 1 },
      providers: { image: img.provider },
      storeConfig: fanaaStore,
      runId: "run_test_image_gen_4",
    });

    expect(img.calls[0].size).toEqual({ w: 1024, h: 1024 });
    expect(img.calls[1].size).toEqual({ w: 1024, h: 1280 });
  });
});
