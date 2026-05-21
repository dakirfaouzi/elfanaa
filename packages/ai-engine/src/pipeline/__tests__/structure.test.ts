import { describe, expect, it } from "vitest";
import { fanaaStore } from "@platform/stores";
import { structure } from "../structure";
import type { StrategyOutput } from "../types-strategy";
import {
  mockText,
  textResult,
} from "./_helpers/mock-providers";

const dummyStrategy: StrategyOutput = {
  heroPromise: { ar: "بشرة موحدة، إشراق طبيعي.", en: "Even skin, natural glow." },
  persona: { ar: "ا", en: "a" },
  benefitAngles: [
    { label: "x", title: { ar: "ا", en: "x" }, body: { ar: "ا", en: "x" } },
    { label: "y", title: { ar: "ا", en: "y" }, body: { ar: "ا", en: "y" } },
    { label: "z", title: { ar: "ا", en: "z" }, body: { ar: "ا", en: "z" } },
  ],
  objections: [
    {
      objection: { ar: "ا", en: "o" },
      neutraliser: { ar: "ا", en: "n" },
    },
    {
      objection: { ar: "ا", en: "o2" },
      neutraliser: { ar: "ا", en: "n2" },
    },
  ],
  adAngles: ["a", "b", "c"],
};

describe("structure (stage 05)", () => {
  it("returns a named template when the model picks one", async () => {
    const t = mockText({
      responses: [
        textResult({
          templateId: "fanaa.generic_pdp",
          customOrdering: [],
          rationale: "covers hero → benefits → social proof",
        }),
      ],
    });

    const out = await structure({
      input: { strategy: dummyStrategy },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_structure_1",
    });

    expect(out.templateId).toBe("fanaa.generic_pdp");
    expect(out.custom).toBe(false);
    expect(out.usedFallback).toBe(false);
    expect(out.sections.length).toBeGreaterThan(0);
    expect(out.sections[0]).toBe("hero");
  });

  it("accepts a valid custom ordering when the model proposes one", async () => {
    const customSections = ["hero", "benefits", "social_proof", "faq"];
    const t = mockText({
      responses: [
        textResult({
          templateId: null,
          customOrdering: customSections,
          rationale: "tight CRO funnel",
        }),
      ],
    });

    const out = await structure({
      input: { strategy: dummyStrategy },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_structure_2",
    });

    expect(out.custom).toBe(true);
    expect(out.templateId).toBe("<custom>");
    expect(out.sections).toEqual(customSections);
    expect(out.usedFallback).toBe(false);
  });

  it("falls back to the store's defaultPdp when the model fails validation", async () => {
    const t = mockText({
      responses: [
        textResult<unknown>(undefined),
        textResult<unknown>(undefined),
      ],
    });

    const out = await structure({
      input: { strategy: dummyStrategy },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_structure_3",
    });

    expect(out.usedFallback).toBe(true);
    expect(out.templateId).toBe(fanaaStore.templates.defaultPdp);
    expect(out.sections).toEqual(
      fanaaStore.templates.orderings[fanaaStore.templates.defaultPdp],
    );
  });

  it("falls back when the model proposes an ordering with unknown sections", async () => {
    const t = mockText({
      responses: [
        textResult({
          templateId: null,
          customOrdering: ["hero", "totally_made_up_section"],
        }),
      ],
    });

    const out = await structure({
      input: { strategy: dummyStrategy },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_structure_4",
    });

    expect(out.usedFallback).toBe(true);
    expect(out.templateId).toBe(fanaaStore.templates.defaultPdp);
  });
});
