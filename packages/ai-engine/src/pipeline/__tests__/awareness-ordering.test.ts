import { describe, expect, it } from "vitest";
import type { SectionKind } from "@platform/catalog-schema";
import { planSectionOrder } from "../awareness-ordering";

const LIBRARY: SectionKind[] = [
  "hero",
  "benefits",
  "how_it_works",
  "ingredients",
  "lifestyle",
  "results_expectation",
  "social_proof",
  "comparison",
  "faq",
  "guarantee",
  "cross_sell",
  "creative_strip",
  "founders_note",
  "sticky_cta",
];

const DEFAULT_ORDERING: SectionKind[] = [
  "hero",
  "benefits",
  "ingredients",
  "lifestyle",
  "social_proof",
  "results_expectation",
  "faq",
  "guarantee",
  "cross_sell",
  "sticky_cta",
];

function plan(
  targeting?: Parameters<typeof planSectionOrder>[0]["targeting"],
) {
  return planSectionOrder({
    targeting,
    sectionLibrary: LIBRARY,
    defaultOrdering: DEFAULT_ORDERING,
  });
}

describe("planSectionOrder", () => {
  it("returns the store default verbatim when no awareness signal", () => {
    expect(plan().sections).toEqual(DEFAULT_ORDERING);
    expect(plan().basis).toBe("default");
    expect(plan({ sophisticationLevel: "expert" }).basis).toBe("default");
  });

  it("only ever emits sections from the library and starts with hero", () => {
    const lib = new Set(LIBRARY);
    for (const awarenessLevel of [
      "unaware",
      "problem-aware",
      "solution-aware",
      "product-aware",
      "most-aware",
    ] as const) {
      const { sections } = plan({ awarenessLevel });
      expect(sections[0]).toBe("hero");
      for (const s of sections) expect(lib.has(s)).toBe(true);
      // No duplicates.
      expect(new Set(sections).size).toBe(sections.length);
    }
  });

  it("never drops a library section (selection is order, not exclusion)", () => {
    const { sections } = plan({ awarenessLevel: "most-aware" });
    expect(new Set(sections)).toEqual(new Set(LIBRARY));
  });

  it("each awareness level yields a distinct ordering", () => {
    const orders = (
      [
        "unaware",
        "problem-aware",
        "solution-aware",
        "product-aware",
        "most-aware",
      ] as const
    ).map((awarenessLevel) => plan({ awarenessLevel }).sections.join(","));
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("is a pure function (stable across calls)", () => {
    const a = plan({ awarenessLevel: "solution-aware", sophisticationLevel: "advanced" });
    const b = plan({ awarenessLevel: "solution-aware", sophisticationLevel: "advanced" });
    expect(a.sections).toEqual(b.sections);
  });

  it("gracefully handles an unknown awareness value (falls back to default)", () => {
    const { basis } = plan({ awarenessLevel: "totally-made-up" });
    expect(basis).toBe("default");
  });

  it("respects a narrower library (omits unsupported kinds)", () => {
    const narrow: SectionKind[] = ["hero", "benefits", "social_proof", "faq"];
    const { sections } = planSectionOrder({
      targeting: { awarenessLevel: "solution-aware" },
      sectionLibrary: narrow,
      defaultOrdering: narrow,
    });
    expect(new Set(sections)).toEqual(new Set(narrow));
    expect(sections[0]).toBe("hero");
  });
});
