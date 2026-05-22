import { describe, expect, it } from "vitest";
import {
  HeroSectionSchema,
  SectionSchema,
  SectionKindSchema,
  SECTION_LABELS,
} from "../sections";
import { makeBlankSection } from "../factories";

describe("SectionSchema", () => {
  it("accepts a valid Hero section", () => {
    const result = HeroSectionSchema.safeParse({
      id: "sec_hero_01",
      kind: "hero",
      enabled: true,
      title: { en: "Glow Serum" },
      align: "center",
      media: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a hero with empty media src", () => {
    const result = HeroSectionSchema.safeParse({
      id: "sec_hero_01",
      kind: "hero",
      title: { en: "X" },
      media: { kind: "image", desktopSrc: "" },
    });
    expect(result.success).toBe(false);
  });

  it("discriminated union dispatches on kind", () => {
    let counter = 0;
    const id = () => `sec_${++counter}`;
    const benefits = makeBlankSection("benefits", id);
    const parsed = SectionSchema.safeParse(benefits);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.kind).toBe("benefits");
    }
  });

  it("every SectionKind has a label", () => {
    for (const kind of SectionKindSchema.options) {
      expect(SECTION_LABELS[kind]).toBeTypeOf("string");
      expect(SECTION_LABELS[kind].length).toBeGreaterThan(0);
    }
  });

  it("rejects unknown section kinds", () => {
    const result = SectionSchema.safeParse({
      id: "sec_x",
      kind: "carousel",
      enabled: true,
    });
    expect(result.success).toBe(false);
  });

  it("benefits.items capped at 12", () => {
    const oversized = {
      id: "sec_b",
      kind: "benefits",
      enabled: true,
      items: Array.from({ length: 13 }, (_, i) => ({
        id: `b_${i}`,
        title: { en: "x" },
      })),
      columns: 3,
    };
    const result = SectionSchema.safeParse(oversized);
    expect(result.success).toBe(false);
  });
});

describe("makeBlankSection", () => {
  it("creates valid blanks for every kind", () => {
    let counter = 0;
    const id = () => `sec_${++counter}`;
    for (const kind of SectionKindSchema.options) {
      const blank = makeBlankSection(kind, id);
      const result = SectionSchema.safeParse(blank);
      expect(result.success, `blank ${kind} should validate`).toBe(true);
    }
  });
});
