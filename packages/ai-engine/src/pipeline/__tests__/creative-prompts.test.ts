import { describe, expect, it } from "vitest";
import { fanaaStore } from "@platform/stores";
import { creativePrompts } from "../creative-prompts";
import { PipelineError } from "../types";
import type { CopyOutput } from "../types-copy";
import type {
  CreativePromptsOutput,
} from "../types-creative-prompts";
import type { StrategyOutput } from "../types-strategy";
import type { StructureOutput } from "../types-structure";
import {
  mockText,
  textResult,
} from "./_helpers/mock-providers";

const dummyStrategy: StrategyOutput = {
  heroPromise: { ar: "إشراق.", en: "Glow." },
  persona: { ar: "ا", en: "a" },
  benefitAngles: [
    { label: "tone", title: { ar: "ا", en: "x" }, body: { ar: "ا", en: "x" } },
    { label: "hydration", title: { ar: "ا", en: "x" }, body: { ar: "ا", en: "x" } },
    { label: "glow", title: { ar: "ا", en: "x" }, body: { ar: "ا", en: "x" } },
  ],
  objections: [
    { objection: { ar: "ا", en: "o" }, neutraliser: { ar: "ا", en: "n" } },
    { objection: { ar: "ا", en: "o" }, neutraliser: { ar: "ا", en: "n" } },
  ],
  adAngles: ["a", "b", "c"],
};

const dummyStructure: StructureOutput = {
  templateId: "fanaa.generic_pdp",
  sections: ["hero"],
  custom: false,
  usedFallback: false,
};

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

const goodPrompts: CreativePromptsOutput = {
  hero: {
    prompt:
      "Studio product photograph of an amber glass dropper serum bottle centred on a warm cream backdrop with soft directional light from the upper left, subtle olive-tan accents, premium minimalist composition, shallow depth of field, high resolution.",
    negative: "text, watermark, hands, glare, blur",
    aspectRatio: "1:1",
  },
  lifestyle: [
    {
      prompt:
        "Editorial lifestyle photograph of a Saudi woman applying serum to her face by a sunlit Riyadh window, soft natural morning light, warm tones, brand palette of warm cream and rose gold accents, intimate composition, premium beauty editorial aesthetic.",
      negative: "text, watermark, hands inside frame",
      aspectRatio: "4:5",
      intent: "morning ritual",
    },
  ],
};

describe("creative-prompts (stage 07)", () => {
  it("returns hero + lifestyle prompts on the happy path", async () => {
    const t = mockText({ responses: [textResult(goodPrompts)] });

    const out = await creativePrompts({
      input: {
        strategy: dummyStrategy,
        structure: dummyStructure,
        copy: dummyCopy,
      },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_creative_1",
    });

    expect(out.hero.prompt.length).toBeGreaterThan(20);
    expect(out.hero.aspectRatio).toBe("1:1");
    expect(out.lifestyle).toHaveLength(1);
  });

  it("rejects when the adapter throws on schema-validation failure twice", async () => {
    // Per the BaseProvider contract, real adapters throw when the model's
    // output fails `schema.safeParse()`. Emulate that by queueing two
    // throw-shaped errors — the helper should retry once then surface a
    // PipelineError.
    const t = mockText({
      responses: [
        new Error("invalid_json_schema: hero required"),
        new Error("invalid_json_schema: hero required"),
      ],
    });

    await expect(
      creativePrompts({
        input: {
          strategy: dummyStrategy,
          structure: dummyStructure,
          copy: dummyCopy,
        },
        providers: { text: t.provider },
        storeConfig: fanaaStore,
        runId: "run_test_creative_2",
      }),
    ).rejects.toBeInstanceOf(PipelineError);
  });

  it("forwards visual hooks from the vision stage into the user prompt", async () => {
    const t = mockText({ responses: [textResult(goodPrompts)] });

    await creativePrompts({
      input: {
        strategy: dummyStrategy,
        structure: dummyStructure,
        copy: dummyCopy,
        vision: {
          skipped: false,
          costUsd: 0,
          visualHooks: ["amber glass", "rose gold"],
        },
      },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_creative_3",
    });

    expect(t.calls[0].prompt).toContain("amber glass");
    expect(t.calls[0].prompt).toContain("rose gold");
  });

  it("grounds the prompt in concrete product-identity attributes from vision (Step 3)", async () => {
    const t = mockText({ responses: [textResult(goodPrompts)] });

    await creativePrompts({
      input: {
        strategy: dummyStrategy,
        structure: dummyStructure,
        copy: dummyCopy,
        vision: {
          skipped: false,
          costUsd: 0,
          productCategory: "face serum",
          formFactor: "amber glass dropper bottle",
          packagingMaterial: "frosted glass",
          visibleColors: ["amber", "rose gold"],
          visibleText: "FANAA GLOW",
          visualHooks: ["amber glass"],
        },
        targeting: { gender: "female", market: "SA", toneStyle: "luxurious" },
      },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_creative_identity",
    });

    const user = t.calls[0].prompt;
    expect(user).toContain("PRODUCT IDENTITY");
    expect(user).toContain("amber glass dropper bottle");
    expect(user).toContain("FANAA GLOW");
    // System prompt carries the identity-preservation rule + audience directive.
    expect(t.calls[0].system).toContain("PRODUCT IDENTITY IS PARAMOUNT");
    expect(t.calls[0].system).toContain("AUDIENCE & POSITIONING DIRECTIVE");
  });
});
