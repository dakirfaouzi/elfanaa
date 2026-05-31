import { describe, expect, it } from "vitest";
import { fanaaStore } from "@platform/stores";
import { structure } from "../structure";
import type { StrategyOutput } from "../types-strategy";
import type { AudienceTargeting } from "../../prompts/audience-directive";

const dummyStrategy: StrategyOutput = {
  heroPromise: { ar: "بشرة موحدة، إشراق طبيعي.", en: "Even skin, natural glow." },
  persona: { ar: "ا", en: "a" },
  benefitAngles: [
    { label: "x", title: { ar: "ا", en: "x" }, body: { ar: "ا", en: "x" } },
    { label: "y", title: { ar: "ا", en: "y" }, body: { ar: "ا", en: "y" } },
    { label: "z", title: { ar: "ا", en: "z" }, body: { ar: "ا", en: "z" } },
  ],
  objections: [
    { objection: { ar: "ا", en: "o" }, neutraliser: { ar: "ا", en: "n" } },
    { objection: { ar: "ا", en: "o2" }, neutraliser: { ar: "ا", en: "n2" } },
  ],
  adAngles: ["a", "b", "c"],
};

function run(targeting?: AudienceTargeting) {
  return structure({
    input: { strategy: dummyStrategy, targeting },
    storeConfig: fanaaStore,
    runId: "run_test_structure",
  });
}

describe("structure (stage 05) — deterministic awareness ordering", () => {
  it("uses the store default ordering when no awareness signal is present", () => {
    const out = run();
    expect(out.usedFallback).toBe(false);
    expect(out.custom).toBe(false);
    expect(out.templateId).toBe(fanaaStore.templates.defaultPdp);
    expect(out.sections).toEqual(
      fanaaStore.templates.orderings[fanaaStore.templates.defaultPdp],
    );
  });

  it("always starts with hero and is a subset of the store section library", () => {
    const out = run({ awarenessLevel: "solution-aware" });
    expect(out.sections[0]).toBe("hero");
    const library = new Set(fanaaStore.templates.sectionLibrary);
    for (const s of out.sections) expect(library.has(s)).toBe(true);
  });

  it("produces a DIFFERENT structure for different awareness levels", () => {
    const unaware = run({ awarenessLevel: "unaware" }).sections;
    const mostAware = run({ awarenessLevel: "most-aware" }).sections;
    expect(unaware).not.toEqual(mostAware);

    // Unaware leads with education (mechanism); most-aware leads with proof.
    const firstStory = (s: string[]) => s.filter((x) => x !== "hero")[0];
    expect(firstStory(unaware)).toBe("how_it_works");
    expect(firstStory(mostAware)).toBe("social_proof");
  });

  it("solution-aware leads with comparison (differentiation)", () => {
    const out = run({ awarenessLevel: "solution-aware" });
    const firstStory = out.sections.filter((s) => s !== "hero")[0];
    expect(firstStory).toBe("comparison");
  });

  it("product-aware front-loads proof + risk reversal", () => {
    const out = run({ awarenessLevel: "product-aware" });
    const story = out.sections.filter((s) => s !== "hero");
    const proofIdx = story.indexOf("social_proof");
    const benefitsIdx = story.indexOf("benefits");
    expect(proofIdx).toBeGreaterThanOrEqual(0);
    expect(proofIdx).toBeLessThan(benefitsIdx);
  });

  it("sophistication meaningfully changes ordering within the same awareness level", () => {
    const beginner = run({
      awarenessLevel: "problem-aware",
      sophisticationLevel: "beginner",
    }).sections;
    const expert = run({
      awarenessLevel: "problem-aware",
      sophisticationLevel: "expert",
    }).sections;
    expect(beginner).not.toEqual(expert);

    // Expert promotes the founder's POV (identity/nuance) far earlier than a
    // beginner market, which doesn't need it up front.
    const idx = (s: string[], k: string) => s.indexOf(k);
    expect(idx(expert, "founders_note")).toBeLessThan(
      idx(beginner, "founders_note"),
    );
  });

  it("pins sticky_cta last and cross_sell just before it when present", () => {
    const out = run({ awarenessLevel: "problem-aware" });
    const n = out.sections.length;
    expect(out.sections[n - 1]).toBe("sticky_cta");
    expect(out.sections[n - 2]).toBe("cross_sell");
  });

  it("includes the new rich section kinds (how_it_works, comparison)", () => {
    const out = run({ awarenessLevel: "problem-aware" });
    expect(out.sections).toContain("how_it_works");
    expect(out.sections).toContain("comparison");
  });
});
