import { describe, expect, it } from "vitest";
import { fanaaStore } from "@platform/stores";
import type {
  ProviderHealth,
} from "../../providers/types";
import type {
  VisionCallOptions,
  VisionProvider,
} from "../../providers/contracts";
import type { VisionResult } from "../../providers/result-types";
import { vision } from "../vision";
import { strategy } from "../strategy";
import { copy } from "../copy";
import { creativePrompts } from "../creative-prompts";
import { imageGen } from "../image-gen";
import type { VisionOutput } from "../types-vision";
import type { StrategyOutput } from "../types-strategy";
import type { StructureOutput } from "../types-structure";
import type { CopyOutput } from "../types-copy";
import type { CreativePromptsOutput } from "../types-creative-prompts";
import {
  imageResult,
  mockImage,
  mockText,
  textResult,
  visionResult,
} from "./_helpers/mock-providers";

/**
 * IDENTITY-FLOW EVIDENCE HARNESS (SmileEase validation, 2026-05-31)
 * ================================================================
 *
 * Proves, with the REAL pipeline stage code (only the model + provider
 * I/O is mocked), that the actual uploaded product identity — NOT a
 * generic store default — reaches strategy, copy, creative prompts and
 * image generation, AND that the pre-fix path went blind.
 *
 * The product under test is the live failure case:
 *   SmileEase — purple TEETH-WHITENING / colour-corrector serum (V34).
 *
 * What is real here: the vision stage, the strategy/copy/creative-prompts
 * prompt builders, the image-gen img2img wiring. What is mocked: the
 * Anthropic/fal network calls. The `blindVisionProvider` faithfully
 * reproduces the real adapter contract — a bare R2 key is sent as
 * `image.source.url`, which the API rejects, so the call throws.
 */

const BARE_KEY = "studio-intake/fanaa/01SMILEEASE_PURPLE.webp";
const RESOLVED_URL = `https://cdn.elfanaa.com/${BARE_KEY}`;

/** What Claude returns for the SmileEase photo once it can actually fetch it. */
const SMILEEASE_VISION = {
  productCategory: "teeth-whitening colour-corrector serum (oral care)",
  formFactor: "30ml airless pump bottle",
  visibleColors: ["#6B4FA1", "#FFFFFF"],
  packagingMaterial: "frosted purple plastic bottle + printed carton",
  visibleText:
    "SmileEase · V34 Colour Corrector Serum · TEETH BRIGHTENING · 30ml / 1 fl oz",
  labelLanguages: ["en"],
  approximateSize: "30ml",
  visualHooks: [
    "purple serum bottle",
    "V34 colour corrector",
    "teeth brightening",
    "purple-toned packaging",
  ],
  confidence: 0.92,
  notes: "Purple ORAL-CARE colour-correcting serum — explicitly NOT skincare.",
} as const;

/**
 * Faithful stand-in for the Anthropic vision adapter:
 *   • non-http(s) src (a bare R2 key) → throw (API can't fetch it)
 *   • http(s) src → return the SmileEase analysis
 */
function blindVisionProvider(): VisionProvider {
  return {
    id: "anthropic",
    async healthCheck(): Promise<ProviderHealth> {
      return { ok: true, providerId: "anthropic", capability: "vision", latencyMs: 0, costUsd: 0 };
    },
    async analyze<T>(o: VisionCallOptions<T>): Promise<VisionResult<T>> {
      const unfetchable = o.images.find((i) => !/^https?:\/\//i.test(i.src));
      if (unfetchable) {
        throw new Error(
          `anthropic image.source.url rejected (not a fetchable URL): "${unfetchable.src}"`,
        );
      }
      return visionResult(SMILEEASE_VISION) as unknown as VisionResult<T>;
    },
  };
}

const SMILEEASE_STRATEGY: StrategyOutput = {
  heroPromise: {
    ar: "ابتسامة أنصع خلال أسبوع — بدون عيادة.",
    en: "A visibly whiter smile in a week — no clinic needed.",
  },
  persona: {
    ar: "امرأة خليجية تهتم بإشراق ابتسامتها.",
    en: "A GCC woman who cares about a bright, confident smile.",
  },
  benefitAngles: [
    { label: "whitening", title: { ar: "تبييض", en: "Whitening" }, body: { ar: "ا", en: "x" } },
    { label: "stain", title: { ar: "إزالة التصبغ", en: "Stain removal" }, body: { ar: "ا", en: "x" } },
    { label: "purple-corrector", title: { ar: "مصحح اللون V34", en: "V34 colour corrector" }, body: { ar: "ا", en: "x" } },
  ],
  objections: [
    { objection: { ar: "هل آمن؟", en: "Is it safe?" }, neutraliser: { ar: "ا", en: "x" } },
    { objection: { ar: "كم يستغرق؟", en: "How long?" }, neutraliser: { ar: "ا", en: "x" } },
  ],
  adAngles: ["smile_confidence", "instant_correction", "at_home_whitening"],
};

const DUMMY_STRUCTURE: StructureOutput = {
  templateId: "fanaa.generic_pdp",
  sections: ["hero", "benefits", "faq"],
  custom: false,
  usedFallback: false,
};

const SMILEEASE_COPY: CopyOutput = {
  title: { ar: "سمايل إيز", en: "SmileEase" },
  headline: { ar: "ابتسامة أنصع من أول استخدام.", en: "A whiter smile from day one." },
  description: { ar: "سيروم بنفسجي يصحح لون الأسنان.", en: "A purple serum that colour-corrects teeth." },
  benefits: [
    { icon: "Sparkles", title: { ar: "تبييض", en: "Whitening" }, body: { ar: "ا", en: "x" } },
    { icon: "Shield", title: { ar: "إزالة التصبغ", en: "Stain removal" }, body: { ar: "ا", en: "x" } },
    { icon: "Smile", title: { ar: "ثقة", en: "Confidence" }, body: { ar: "ا", en: "x" } },
  ],
};

const SMILEEASE_CREATIVE: CreativePromptsOutput = {
  hero: {
    prompt:
      "Studio product shot of a frosted purple 30ml airless pump bottle labelled 'SmileEase V34 Colour Corrector' for teeth brightening, clean backdrop, centred, soft directional light.",
    negative: "text artefacts, watermark, hands, glare",
    aspectRatio: "1:1",
  },
  lifestyle: [
    {
      prompt: "GCC woman smiling with bright teeth holding the purple SmileEase bottle, soft natural light.",
      negative: "watermark",
      aspectRatio: "4:5",
      intent: "smile_confidence",
    },
  ],
};

const ctx = { runId: "run_trace_smileease", storeConfig: fanaaStore } as const;

function banner(label: string, body: string): void {
  // eslint-disable-next-line no-console
  console.log(`\n===== EVIDENCE: ${label} =====\n${body}\n`);
}

describe("SmileEase identity-flow evidence", () => {
  it("(1) BEFORE FIX — bare R2 key makes vision throw → silently SKIPPED → strategy gets no identity", async () => {
    const before: VisionOutput = await vision({
      ...ctx,
      input: { images: [{ src: BARE_KEY, alt: "SmileEase" }] },
      providers: { vision: blindVisionProvider() },
    });

    banner(
      "1 — vision output BEFORE fix (bare key)",
      JSON.stringify(before, null, 2),
    );
    expect(before.skipped).toBe(true);
    expect(before.skipReason).toContain("vision_failed");
    expect(before.productCategory).toBeUndefined();

    // Strategy with a skipped vision → no product identity in the prompt.
    const t = mockText({ responses: [textResult(SMILEEASE_STRATEGY)] });
    await strategy({
      ...ctx,
      input: { supplierUrl: "", vision: before, operatorNotes: "luxury beauty product" },
      providers: { text: t.provider },
    });
    const strategyPromptBefore = t.calls[0]!.prompt;
    banner("1b — strategy USER prompt BEFORE fix", strategyPromptBefore);
    expect(strategyPromptBefore).toContain("No vision summary");
    expect(strategyPromptBefore.toLowerCase()).not.toContain("teeth");
  });

  it("(2) AFTER FIX — resolved CDN URL → vision SEES SmileEase", async () => {
    const provider = blindVisionProvider();
    const calls: string[] = [];
    const capturing: VisionProvider = {
      id: provider.id,
      healthCheck: provider.healthCheck.bind(provider),
      async analyze<T>(o: VisionCallOptions<T>): Promise<VisionResult<T>> {
        calls.push(...o.images.map((i) => i.src));
        return provider.analyze(o);
      },
    };

    const after: VisionOutput = await vision({
      ...ctx,
      input: { images: [{ src: RESOLVED_URL, alt: "SmileEase" }] },
      providers: { vision: capturing },
    });

    banner("2a — URL the vision provider RECEIVED", calls.join("\n"));
    banner("2b — vision output AFTER fix", JSON.stringify(after, null, 2));
    expect(calls[0]).toBe(RESOLVED_URL);
    expect(after.skipped).toBe(false);
    expect(after.productCategory).toContain("teeth-whitening");
    expect(after.visibleText).toContain("SmileEase");
  });

  it("(3) strategy receives the SmileEase identity", async () => {
    const after = await vision({
      ...ctx,
      input: { images: [{ src: RESOLVED_URL }] },
      providers: { vision: blindVisionProvider() },
    });
    const t = mockText({ responses: [textResult(SMILEEASE_STRATEGY)] });
    await strategy({
      ...ctx,
      input: { supplierUrl: "", vision: after, operatorNotes: "" },
      providers: { text: t.provider },
    });
    const prompt = t.calls[0]!.prompt;
    banner("3 — strategy USER prompt AFTER fix (product identity block)", prompt);
    expect(prompt).toContain("teeth-whitening");
    expect(prompt).toContain("SmileEase");
    expect(prompt).toContain("V34");
    expect(t.calls[0]!.system).toContain("PRODUCT FIDELITY");
  });

  it("(4) copy receives the SmileEase identity (category + label text)", async () => {
    const after = await vision({
      ...ctx,
      input: { images: [{ src: RESOLVED_URL }] },
      providers: { vision: blindVisionProvider() },
    });
    const t = mockText({ responses: [textResult(SMILEEASE_COPY)] });
    await copy({
      ...ctx,
      input: { strategy: SMILEEASE_STRATEGY, structure: DUMMY_STRUCTURE, vision: after },
      providers: { text: t.provider },
    });
    const prompt = t.calls[0]!.prompt;
    banner("4 — copy USER prompt AFTER fix", prompt);
    expect(prompt).toContain("PRODUCT (write about THIS exact product)");
    expect(prompt).toContain("teeth-whitening");
    expect(prompt).toContain("SmileEase");
    expect(t.calls[0]!.system).toContain("PRODUCT FIDELITY");
  });

  it("(5) creative prompts + image generation receive the SmileEase identity and the real photo as img2img reference", async () => {
    const after = await vision({
      ...ctx,
      input: { images: [{ src: RESOLVED_URL }] },
      providers: { vision: blindVisionProvider() },
    });

    // 5a — creative prompts user prompt carries the identity block.
    const t = mockText({ responses: [textResult(SMILEEASE_CREATIVE)] });
    await creativePrompts({
      ...ctx,
      input: {
        strategy: SMILEEASE_STRATEGY,
        structure: DUMMY_STRUCTURE,
        copy: SMILEEASE_COPY,
        vision: after,
      },
      providers: { text: t.provider },
    });
    const creativePrompt = t.calls[0]!.prompt;
    banner("5a — creative-prompts USER prompt (PRODUCT IDENTITY block)", creativePrompt);
    expect(creativePrompt).toContain("PRODUCT IDENTITY (depict THIS exact product)");
    expect(creativePrompt).toContain("teeth-whitening");
    expect(creativePrompt).toContain("SmileEase");

    // 5b — image generation: hero goes img2img (Kontext) on the REAL photo.
    const img = mockImage({ responses: [imageResult(), imageResult()] });
    await imageGen({
      ...ctx,
      input: {
        prompts: SMILEEASE_CREATIVE,
        referenceImage: { src: RESOLVED_URL, alt: "SmileEase" },
      },
      providers: { image: img.provider },
    });
    const heroCall = img.calls[0]!;
    banner(
      "5b — image-gen HERO provider call",
      JSON.stringify(
        {
          model: heroCall.model,
          referenceImages: heroCall.referenceImages,
          prompt: heroCall.prompt,
        },
        null,
        2,
      ),
    );
    expect(heroCall.model).toContain("kontext");
    expect(heroCall.referenceImages?.[0]?.src).toBe(RESOLVED_URL);
    expect(heroCall.prompt).toContain("keep the");
  });
});
