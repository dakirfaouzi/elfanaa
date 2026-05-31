import { describe, expect, it } from "vitest";
import { fanaaStore } from "@platform/stores";
import { copy } from "../copy";
import { PipelineError } from "../types";
import type { CopyOutput } from "../types-copy";
import type { StrategyOutput } from "../types-strategy";
import type { StructureOutput } from "../types-structure";
import {
  mockText,
  textResult,
} from "./_helpers/mock-providers";

const dummyStrategy: StrategyOutput = {
  heroPromise: { ar: "بشرة موحدة.", en: "Even skin." },
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
  sections: ["hero", "benefits", "faq"],
  custom: false,
  usedFallback: false,
};

const cleanCopy: CopyOutput = {
  title: { ar: "سيروم النور", en: "Glow Serum" },
  headline: { ar: "إشراق يومي طبيعي.", en: "Daily natural glow." },
  subheadline: {
    ar: "للبشرة الحساسة والعادية.",
    en: "For sensitive and normal skin.",
  },
  description: {
    ar: "سيروم خفيف يمنح البشرة ترطيبًا وإشراقًا من أول استعمال.",
    en: "A lightweight serum that hydrates and brightens from the first use.",
  },
  benefits: [
    {
      icon: "Sparkles",
      title: { ar: "إشراق طبيعي", en: "Natural glow" },
      body: {
        ar: "نتيجة فورية مع الاستعمال المنتظم.",
        en: "Immediate finish with regular use.",
      },
    },
    {
      icon: "Droplet",
      title: { ar: "ترطيب عميق", en: "Deep hydration" },
      body: {
        ar: "يحبس الرطوبة لمدة طويلة.",
        en: "Locks in moisture for hours.",
      },
    },
    {
      icon: "Shield",
      title: { ar: "حماية يومية", en: "Daily protection" },
      body: {
        ar: "يحمي البشرة من التهيج.",
        en: "Protects skin from daily irritation.",
      },
    },
  ],
  foundersNote: {
    ar: "صنعنا هذا السيروم ليكون رفيقك اليومي.",
    en: "We crafted this serum to be your daily companion.",
  },
};

describe("copy (stage 06)", () => {
  it("returns the parsed copy on the happy path", async () => {
    const t = mockText({ responses: [textResult(cleanCopy)] });

    const out = await copy({
      input: { strategy: dummyStrategy, structure: dummyStructure },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_copy_1",
    });

    expect(out.title.ar).toBe("سيروم النور");
    expect(out.title.en).toBe("Glow Serum");
    expect(out.benefits).toHaveLength(3);
    expect(t.calls).toHaveLength(1);
  });

  it("retries once when the Arabic field contains Latin letters (locale bleed)", async () => {
    const bleedingCopy: CopyOutput = {
      ...cleanCopy,
      title: { ar: "Glow سيروم", en: "Glow Serum" },
    };

    const t = mockText({
      responses: [textResult(bleedingCopy), textResult(cleanCopy)],
    });

    const out = await copy({
      input: { strategy: dummyStrategy, structure: dummyStructure },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_copy_2",
    });

    expect(out.title.ar).toBe("سيروم النور");
    expect(t.calls).toHaveLength(2);
    expect(t.calls[1].system).toContain("WRONG language");
  });

  it("retries once when forbidden brand-voice words appear", async () => {
    const forbiddenCopy: CopyOutput = {
      ...cleanCopy,
      description: {
        ar: "سيروم يعالج البشرة بسرعة فائقة.",
        en: "A serum that treats skin instantly.",
      },
    };

    const t = mockText({
      responses: [textResult(forbiddenCopy), textResult(cleanCopy)],
    });

    const out = await copy({
      input: { strategy: dummyStrategy, structure: dummyStructure },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_copy_3",
    });

    expect(out.description.en).toBe(cleanCopy.description.en);
    expect(t.calls).toHaveLength(2);
    expect(t.calls[1].system).toContain("forbidden words");
  });

  it("injects the audience directive into the copy system prompt (Step 3)", async () => {
    const t = mockText({ responses: [textResult(cleanCopy)] });

    await copy({
      input: {
        strategy: dummyStrategy,
        structure: dummyStructure,
        targeting: { awarenessLevel: "most-aware", toneStyle: "intimate" },
      },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_copy_targeting",
    });

    expect(t.calls[0].system).toContain("AUDIENCE & POSITIONING DIRECTIVE");
    expect(t.calls[0].system).toContain("MOST-AWARE");
    expect(t.calls[0].system).toContain("INTIMATE");
  });

  it("throws PipelineError when guardrails keep failing after the retry", async () => {
    const t = mockText({
      responses: [
        textResult({
          ...cleanCopy,
          title: { ar: "Bad Arabic", en: "Good English" },
        }),
        textResult({
          ...cleanCopy,
          title: { ar: "Still Bad", en: "Good English" },
        }),
      ],
    });

    await expect(
      copy({
        input: { strategy: dummyStrategy, structure: dummyStructure },
        providers: { text: t.provider },
        storeConfig: fanaaStore,
        runId: "run_test_copy_4",
      }),
    ).rejects.toBeInstanceOf(PipelineError);
  });
});
