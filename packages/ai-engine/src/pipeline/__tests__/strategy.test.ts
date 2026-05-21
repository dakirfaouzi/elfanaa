import { describe, expect, it } from "vitest";
import { fanaaStore } from "@platform/stores";
import { strategy } from "../strategy";
import { PipelineError } from "../types";
import type { StrategyOutput } from "../types-strategy";
import {
  mockText,
  textResult,
} from "./_helpers/mock-providers";

const goodStrategy: StrategyOutput = {
  heroPromise: {
    ar: "بشرة موحدة، إشراق طبيعي.",
    en: "Even skin, natural glow.",
  },
  persona: {
    ar: "امرأة سعودية مهتمة بالعناية بالبشرة.",
    en: "A Saudi woman who cares about her skincare ritual.",
  },
  benefitAngles: [
    {
      label: "even_tone",
      title: { ar: "توحيد لون البشرة", en: "Even skin tone" },
      body: {
        ar: "يساعد على تفتيح البقع تدريجيًا.",
        en: "Gradually brightens uneven patches.",
      },
    },
    {
      label: "hydration",
      title: { ar: "ترطيب عميق", en: "Deep hydration" },
      body: {
        ar: "يحبس الرطوبة طوال اليوم.",
        en: "Locks in moisture all day.",
      },
    },
    {
      label: "glow",
      title: { ar: "إشراق طبيعي", en: "Natural glow" },
      body: {
        ar: "نتيجة طبيعية من أول استعمال.",
        en: "Natural finish from the first use.",
      },
    },
  ],
  objections: [
    {
      objection: { ar: "هل آمن للبشرة الحساسة؟", en: "Is it safe for sensitive skin?" },
      neutraliser: {
        ar: "تركيبة خفيفة بدون كحول.",
        en: "Lightweight alcohol-free formula.",
      },
    },
    {
      objection: { ar: "متى أشوف النتائج؟", en: "When will I see results?" },
      neutraliser: {
        ar: "تحسن ملحوظ خلال أسبوعين.",
        en: "Noticeable improvement within two weeks.",
      },
    },
  ],
  adAngles: ["emotional_transformation", "ingredient_authority", "ritual_aesthetic"],
};

describe("strategy (stage 04)", () => {
  it("returns the Zod-parsed brief on the happy path", async () => {
    const t = mockText({ responses: [textResult(goodStrategy)] });

    const out = await strategy({
      input: { supplierUrl: "https://supplier.example/p/1" },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_strategy_1",
    });

    expect(out.heroPromise.en).toBe("Even skin, natural glow.");
    expect(out.benefitAngles).toHaveLength(3);
    expect(t.calls).toHaveLength(1);
  });

  it("auto-retries on a malformed first response then succeeds", async () => {
    const t = mockText({
      responses: [
        // First call: parsed undefined → triggers retry
        textResult<unknown>(undefined, { text: "not json", parsed: undefined }),
        // Second call: valid
        textResult(goodStrategy),
      ],
    });

    const out = await strategy({
      input: { supplierUrl: "https://supplier.example/p/1" },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_strategy_2",
    });

    expect(out.heroPromise.en).toBe("Even skin, natural glow.");
    expect(t.calls).toHaveLength(2);
    // Second call's system prompt should include the "fix JSON" suffix
    expect(t.calls[1].system).toContain(
      "Your previous response failed JSON-schema validation",
    );
  });

  it("throws PipelineError after retries exhausted", async () => {
    const t = mockText({
      responses: [
        textResult<unknown>(undefined),
        textResult<unknown>(undefined),
      ],
    });

    await expect(
      strategy({
        input: { supplierUrl: "https://supplier.example/p/1" },
        providers: { text: t.provider },
        storeConfig: fanaaStore,
        runId: "run_test_strategy_3",
      }),
    ).rejects.toBeInstanceOf(PipelineError);
  });

  it("passes the store's niche-default ad angles into the prompt", async () => {
    const t = mockText({ responses: [textResult(goodStrategy)] });

    await strategy({
      input: { supplierUrl: "https://supplier.example/p/1" },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_strategy_4",
    });

    expect(t.calls[0].prompt).toContain("emotional_transformation");
    expect(t.calls[0].prompt).toContain("ingredient_authority");
  });
});
