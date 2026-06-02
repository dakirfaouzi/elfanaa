import { describe, expect, it } from "vitest";
import { fanaaStore } from "@platform/stores";
import { buildSceneIdentityPrompt, imageGen } from "../image-gen";
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

describe("buildSceneIdentityPrompt (Phase 4.6.4b asset-aware wrapper)", () => {
  it("always carries the identity lock", () => {
    for (const intent of ["ingredient", "mechanism", "proof", "result", "context", undefined]) {
      expect(buildSceneIdentityPrompt("scene", intent)).toMatch(/SINGLE SOURCE OF TRUTH/i);
    }
  });

  it("renders a MACRO for ingredient/detail (full person optional)", () => {
    const p = buildSceneIdentityPrompt("droplet swatch", "ingredient");
    expect(p).toMatch(/MACRO/);
    expect(p).toMatch(/full person is optional/i);
  });

  it("renders an APPLICATION moment for mechanism", () => {
    expect(buildSceneIdentityPrompt("apply to under-eye", "mechanism")).toMatch(
      /APPLICATION \/ USAGE moment/i,
    );
  });

  it("renders a customer PORTRAIT for proof", () => {
    expect(buildSceneIdentityPrompt("confident customer", "proof")).toMatch(/PORTRAIT/);
  });

  it("renders an OUTCOME end-state for result", () => {
    expect(buildSceneIdentityPrompt("radiant skin", "result")).toMatch(/OUTCOME end-state/i);
  });

  it("falls back to a product + human composite for context/unknown intents", () => {
    expect(buildSceneIdentityPrompt("at home", "context")).toMatch(/person using or holding it/i);
  });
});

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

  it("generates the hero img2img (Kontext) when a servable reference URL is supplied (Step 3)", async () => {
    const img = mockImage({
      responses: [imageResult({ url: "https://cdn.mock/hero-identity.webp" })],
    });

    const out = await imageGen({
      input: {
        prompts: promptsHeroOnly,
        maxAttemptsPerPrompt: 1,
        referenceImage: { src: "https://cdn.elfanaa.com/studio-intake/p.jpg" },
      },
      providers: { image: img.provider },
      storeConfig: fanaaStore,
      runId: "run_test_image_gen_img2img",
    });

    expect(out.results).toHaveLength(1);
    expect(out.results[0]?.role).toBe("hero");
    // Hero call routed to the identity-preserving Kontext model with the
    // reference image attached.
    expect(img.calls[0].model).toBe("fal-ai/flux-pro/kontext");
    expect(img.calls[0].referenceImages?.[0]?.src).toBe(
      "https://cdn.elfanaa.com/studio-intake/p.jpg",
    );
    expect(img.calls[0].prompt).toMatch(/single source of truth/i);
  });

  it("falls back to the operator's REAL product photo (no substitution) when Kontext fails", async () => {
    const img = mockImage({
      responses: [new Error("kontext_unavailable")],
    });

    const out = await imageGen({
      input: {
        prompts: promptsHeroOnly,
        maxAttemptsPerPrompt: 1,
        referenceImage: { src: "https://cdn.elfanaa.com/studio-intake/p.jpg" },
      },
      providers: { image: img.provider },
      storeConfig: fanaaStore,
      runId: "run_test_image_gen_img2img_fallback",
    });

    expect(out.results).toHaveLength(1);
    // Phase 4.6.1: NEVER invent a hero text-to-image. Pass the real product
    // photo through instead so the uploaded product identity is preserved.
    expect(out.results[0]?.url).toBe("https://cdn.elfanaa.com/studio-intake/p.jpg");
    expect(out.results[0]?.model).toBe("reference_passthrough");
    expect(out.results[0]?.costUsd).toBe(0);
    // Only ONE provider call (the failed Kontext) — we did NOT call the image
    // model a second time to invent a substitute product.
    expect(img.calls).toHaveLength(1);
    expect(img.calls[0].model).toBe("fal-ai/flux-pro/kontext");
  });

  it("grounds lifestyle scenes img2img on the reference too (Phase 4.6 — product in-scene)", async () => {
    const img = mockImage({
      responses: [
        imageResult({ url: "https://cdn.mock/hero-identity.webp" }),
        imageResult({ url: "https://cdn.mock/scene-1.webp", width: 1024, height: 1280 }),
        imageResult({ url: "https://cdn.mock/scene-2.webp", width: 1024, height: 1280 }),
      ],
    });

    const out = await imageGen({
      input: {
        prompts: promptsThree,
        maxAttemptsPerPrompt: 1,
        referenceImage: { src: "https://cdn.elfanaa.com/studio-intake/p.jpg" },
      },
      providers: { image: img.provider },
      storeConfig: fanaaStore,
      runId: "run_test_image_gen_scene_identity",
    });

    expect(out.results).toHaveLength(3);
    // Every call (hero + both scenes) routed to Kontext with the reference.
    for (const call of img.calls) {
      expect(call.model).toBe("fal-ai/flux-pro/kontext");
      expect(call.referenceImages?.[0]?.src).toBe(
        "https://cdn.elfanaa.com/studio-intake/p.jpg",
      );
    }
    // Scene calls use the scene identity wrapper (composite product into scene),
    // and every call carries the shared identity lock.
    const sceneCall = img.calls.find((c) =>
      /composite this exact product naturally into a premium advertising scene/i.test(c.prompt),
    );
    expect(sceneCall).toBeDefined();
    for (const call of img.calls) {
      expect(call.prompt).toMatch(/single source of truth/i);
    }
  });

  it("falls back to text-to-image for a scene when its Kontext attempt fails (no regression)", async () => {
    const img = mockImage({
      responses: [
        imageResult({ url: "https://cdn.mock/hero.webp" }),
        new Error("kontext_scene_unavailable"),
        imageResult({ url: "https://cdn.mock/scene-fallback.webp", width: 1024, height: 1280 }),
        imageResult({ url: "https://cdn.mock/scene-2.webp", width: 1024, height: 1280 }),
      ],
    });

    const out = await imageGen({
      input: {
        prompts: promptsThree,
        maxAttemptsPerPrompt: 1,
        referenceImage: { src: "https://cdn.elfanaa.com/studio-intake/p.jpg" },
      },
      providers: { image: img.provider },
      storeConfig: fanaaStore,
      runId: "run_test_image_gen_scene_fallback",
    });

    // Hero + 2 scenes all produced (one scene via fallback).
    expect(out.results).toHaveLength(3);
    expect(out.failed).toHaveLength(0);
    expect(out.results.map((r) => r.url)).toContain("https://cdn.mock/scene-fallback.webp");
  });

  it("does NOT use img2img when the reference is a bare R2 key (unservable)", async () => {
    const img = mockImage({
      responses: [imageResult({ url: "https://cdn.mock/hero.webp" })],
    });

    await imageGen({
      input: {
        prompts: promptsHeroOnly,
        maxAttemptsPerPrompt: 1,
        referenceImage: { src: "studio-intake/p.jpg" },
      },
      providers: { image: img.provider },
      storeConfig: fanaaStore,
      runId: "run_test_image_gen_bare_key",
    });

    expect(img.calls[0].model).toBeUndefined();
    expect(img.calls[0].referenceImages).toBeUndefined();
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
