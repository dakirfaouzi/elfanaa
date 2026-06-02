import { describe, expect, it } from "vitest";
import { fanaaStore } from "@platform/stores";
import { sectionContent } from "../section-content";
import { SectionContentOutputSchema } from "../../schemas/section-content";
import { PipelineError } from "../types";
import type { StrategyOutput } from "../types-strategy";
import type { SectionContentOutput } from "../types-section-content";
import { mockText, textResult } from "./_helpers/mock-providers";

const dummyStrategy: StrategyOutput = {
  heroPromise: { ar: "بشرة موحدة.", en: "Even skin." },
  persona: { ar: "امرأة عصرية.", en: "A modern woman." },
  benefitAngles: [
    { label: "tone", title: { ar: "ا", en: "x" }, body: { ar: "ا", en: "x" } },
    { label: "hydration", title: { ar: "ا", en: "x" }, body: { ar: "ا", en: "x" } },
    { label: "glow", title: { ar: "ا", en: "x" }, body: { ar: "ا", en: "x" } },
  ],
  objections: [
    { objection: { ar: "غالي.", en: "Expensive." }, neutraliser: { ar: "يستحق.", en: "Worth it." } },
    { objection: { ar: "بطيء.", en: "Slow." }, neutraliser: { ar: "نتائج سريعة.", en: "Fast results." } },
  ],
  adAngles: ["a", "b", "c"],
};

const clean: SectionContentOutput = {
  howItWorks: {
    summary: { ar: "يرطب البشرة بعمق.", en: "Hydrates skin deeply." },
    steps: [
      { title: { ar: "يخترق", en: "Penetrates" }, body: { ar: "بسرعة.", en: "Quickly." } },
      { title: { ar: "يرطب", en: "Hydrates" }, body: { ar: "بعمق.", en: "Deeply." } },
    ],
  },
  ingredients: [
    { name: { ar: "حمض الهيالورونيك", en: "Hyaluronic acid" }, role: { ar: "يرطب.", en: "Hydrates." } },
  ],
  guarantee: {
    title: { ar: "دفع عند الاستلام", en: "Cash on delivery" },
    body: { ar: "إرجاع سهل.", en: "Easy returns." },
  },
};

describe("sectionContent (stage 11b)", () => {
  it("returns the parsed rich content on the happy path", async () => {
    const t = mockText({ responses: [textResult(clean)] });

    const out = await sectionContent({
      input: { strategy: dummyStrategy },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_sc_1",
    });

    expect(out.howItWorks?.steps).toHaveLength(2);
    expect(out.ingredients?.[0]?.name.en).toBe("Hyaluronic acid");
    expect(out.guarantee?.title.en).toBe("Cash on delivery");
    expect(t.calls).toHaveLength(1);
  });

  it("passes the strategy objections into the prompt as grounding", async () => {
    const t = mockText({ responses: [textResult(clean)] });

    await sectionContent({
      input: { strategy: dummyStrategy },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_sc_2",
    });

    expect(t.calls[0]!.prompt).toContain("Expensive.");
  });

  it("retries once on a locale bleed in a nested block", async () => {
    const bleeding: SectionContentOutput = {
      ...clean,
      howItWorks: {
        summary: { ar: "Hydrates بعمق.", en: "Hydrates deeply." },
        steps: clean.howItWorks!.steps,
      },
    };

    const t = mockText({
      responses: [textResult(bleeding), textResult(clean)],
    });

    const out = await sectionContent({
      input: { strategy: dummyStrategy },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_sc_3",
    });

    expect(out.howItWorks?.summary.ar).toBe("يرطب البشرة بعمق.");
    expect(t.calls).toHaveLength(2);
    expect(t.calls[1]!.system).toContain("WRONG language");
  });

  it("degrades a null ingredients to an omitted block (never fatal)", () => {
    // Reproduces the production failure: the model honestly returned
    // `ingredients: null` (couldn't ground a concrete list) and the strict
    // `.optional()` schema threw `expected array, received null`, killing the
    // whole run. The fault-tolerant schema must now drop it instead.
    const parsed = SectionContentOutputSchema.parse({
      ...clean,
      ingredients: null,
    });

    expect(parsed.ingredients).toBeUndefined();
    expect(parsed.howItWorks?.steps).toHaveLength(2);
    expect(parsed.guarantee?.title.en).toBe("Cash on delivery");
  });

  it("degrades empty / malformed blocks to omissions without throwing", () => {
    const parsed = SectionContentOutputSchema.parse({
      howItWorks: { summary: { ar: "ا", en: "x" }, steps: [] }, // too few steps → drop
      ingredients: [], // violates .min(1) → drop
      results: null, // null → drop
      guarantee: { title: 123 }, // malformed → drop
      comparison: undefined, // absent → drop
    });

    expect(parsed.ingredients).toBeUndefined();
    expect(parsed.results).toBeUndefined();
    expect(parsed.guarantee).toBeUndefined();
    expect(parsed.comparison).toBeUndefined();
  });

  it("keeps a well-formed block while dropping a broken sibling", () => {
    const parsed = SectionContentOutputSchema.parse({
      ingredients: null,
      guarantee: clean.guarantee,
    });

    expect(parsed.ingredients).toBeUndefined();
    expect(parsed.guarantee?.title.en).toBe("Cash on delivery");
  });

  it("throws after a persistent locale bleed", async () => {
    const bleeding: SectionContentOutput = {
      ...clean,
      guarantee: {
        title: { ar: "COD مجاني", en: "Free COD" },
        body: { ar: "إرجاع سهل.", en: "Easy returns." },
      },
    };

    const t = mockText({
      responses: [textResult(bleeding), textResult(bleeding)],
    });

    await expect(
      sectionContent({
        input: { strategy: dummyStrategy },
        providers: { text: t.provider },
        storeConfig: fanaaStore,
        runId: "run_test_sc_4",
      }),
    ).rejects.toBeInstanceOf(PipelineError);
  });
});
