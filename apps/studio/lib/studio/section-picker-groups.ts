import type { SectionKind } from "@platform/builder-schema";

/**
 * Section-picker groups (C2 / drafts builder polish).
 *
 * The flat 10-chip row in the M11 builder ("+ Hero", "+ Benefits",
 * "+ Before/After", "+ Testimonials", "+ CTA", "+ FAQ", "+ Sticky CTA",
 * "+ Video", "+ Image gallery", "+ Rich text") was visually noisy and
 * gave no hint about which section to pick when. Operators were
 * scanning the row by trial-and-error.
 *
 * Grouping into three categories — `Hero / CTA`, `Storytelling`,
 * `Media` — gives the picker a mental shape that mirrors how the
 * actual product page is built:
 *
 *   • Hero / CTA   — entry, exit, persistent conversion surfaces.
 *   • Storytelling — the narrative that earns the conversion.
 *   • Media        — pure visual payloads.
 *
 * # Why the data lives here (not in @platform/builder-schema)
 *
 * The schema package is the canonical contract — adding a "picker
 * group" field to the schema would conflate presentation with the
 * data model. The grouping is a UI-only decision that may evolve as
 * the builder UX matures; pinning it to the Studio app keeps the
 * contract clean.
 *
 * # Schema guard
 *
 * The companion unit test re-imports `SectionKindSchema.options`
 * from `@platform/builder-schema` and asserts every kind is in
 * EXACTLY ONE group. If a new kind is added to the schema, the
 * test fails loudly in CI rather than the operator silently losing
 * access to it through the picker.
 */

export interface SectionPickerGroup {
  /** Stable id — used as React key + telemetry tag. */
  id: "hero_cta" | "storytelling" | "media";
  /** Operator-facing eyebrow label rendered above the chip row. */
  label: string;
  /** Section kinds in this group, in render order. */
  kinds: SectionKind[];
}

/**
 * Canonical 3-group split for the picker. Every `SectionKind` from
 * `@platform/builder-schema` MUST appear in exactly one group — the
 * unit test enforces this.
 */
export const SECTION_PICKER_GROUPS: SectionPickerGroup[] = [
  {
    id: "hero_cta",
    label: "Hero / CTA",
    kinds: ["hero", "cta", "sticky_cta"],
  },
  {
    id: "storytelling",
    label: "Storytelling",
    kinds: ["benefits", "before_after", "testimonials", "faq", "rich_text"],
  },
  {
    id: "media",
    label: "Media",
    kinds: ["video", "image_gallery"],
  },
];
