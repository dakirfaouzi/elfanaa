import type { Section, SectionKind } from "./sections";
import type { DraftDocument } from "./draft";

/**
 * Section factories — produce "blank" sections for the builder's
 * insert flow.
 *
 * The reducer calls `makeBlankSection(kind, idGenerator)` whenever
 * the operator clicks "Add section" in the UI. Each blank carries:
 *
 *   • a unique id (caller-provided so tests can be deterministic)
 *   • sensible defaults (enabled = true, layout = side_by_side, etc.)
 *   • empty content (no media, empty arrays, empty locale fields)
 *
 * Why separate from the schemas: the schemas are pure validation;
 * defaults live here so tests can construct sections without going
 * through Zod's `.default()` chain.
 */

export type SectionIdGen = () => string;

export function makeBlankSection(
  kind: SectionKind,
  newId: SectionIdGen,
): Section {
  switch (kind) {
    case "hero":
      return {
        id: newId(),
        kind: "hero",
        enabled: true,
        title: { ar: "", en: "" },
        subtitle: { ar: "", en: "" },
        ctaLabel: { ar: "", en: "" },
        ctaHref: "",
        media: null,
        align: "center",
      };
    case "benefits":
      return {
        id: newId(),
        kind: "benefits",
        enabled: true,
        eyebrow: { ar: "", en: "" },
        title: { ar: "", en: "" },
        items: [],
        columns: 3,
      };
    case "before_after":
      return {
        id: newId(),
        kind: "before_after",
        enabled: true,
        title: { ar: "", en: "" },
        pairs: [],
        layout: "side_by_side",
      };
    case "testimonials":
      return {
        id: newId(),
        kind: "testimonials",
        enabled: true,
        title: { ar: "", en: "" },
        items: [],
        display: "grid",
      };
    case "cta":
      return {
        id: newId(),
        kind: "cta",
        enabled: true,
        title: { ar: "", en: "" },
        subtitle: { ar: "", en: "" },
        primaryLabel: { ar: "", en: "" },
        primaryHref: "#",
        variant: "solid",
      };
    case "faq":
      return {
        id: newId(),
        kind: "faq",
        enabled: true,
        title: { ar: "", en: "" },
        items: [],
      };
    case "sticky_cta":
      return {
        id: newId(),
        kind: "sticky_cta",
        enabled: true,
        label: { ar: "", en: "" },
        href: "#",
        bottomOffsetPx: 0,
      };
    case "video":
      return {
        id: newId(),
        kind: "video",
        enabled: true,
        title: { ar: "", en: "" },
        media: null,
        autoplay: false,
        loop: false,
        muted: true,
        controls: true,
      };
    case "image_gallery":
      return {
        id: newId(),
        kind: "image_gallery",
        enabled: true,
        title: { ar: "", en: "" },
        items: [],
        columns: 3,
      };
    case "rich_text":
      return {
        id: newId(),
        kind: "rich_text",
        enabled: true,
        body: { ar: "", en: "" },
        width: "narrow",
      };
  }
}

/**
 * Blank draft used when the operator clicks "New draft" in the UI.
 * Carries one Hero + one CTA so the canvas isn't empty.
 */
export function makeBlankDraft(opts: {
  slug: string;
  title: { ar?: string; en?: string };
  newId: SectionIdGen;
}): DraftDocument {
  return {
    version: 1,
    meta: {
      title: opts.title,
      slug: opts.slug,
      description: { ar: "", en: "" },
      keywords: [],
    },
    sections: [
      makeBlankSection("hero", opts.newId),
      makeBlankSection("cta", opts.newId),
    ],
  };
}
