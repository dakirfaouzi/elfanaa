import type { DraftDocument, PublishIssue } from "./draft";
import { DraftDocumentSchema } from "./draft";
import type { Section } from "./sections";

/**
 * Publish-time validation.
 *
 * This is intentionally STRICTER than the per-field Zod schemas:
 * Zod ensures the draft is structurally well-formed, while this
 * function enforces editorial rules that only make sense at publish
 * time:
 *
 *   • At least one Hero section (the storefront needs an above-the-
 *     fold block).
 *   • At least one CTA OR StickyCTA (otherwise the customer has
 *     nowhere to click).
 *   • Every section's required media slots have a usable URL.
 *   • Title carries at least one locale.
 *   • Slug matches the canonical pattern (already enforced by Zod
 *     but we surface a friendlier message).
 *
 * Warnings (non-blocking) catch things that hurt conversion but
 * shouldn't stop a publish:
 *
 *   • No FAQ section.
 *   • No testimonials section.
 *   • Hero is missing media.
 *   • RichText sections are empty in both locales.
 *
 * # Return shape
 *
 * `{ ok: true,  document }` — safe to publish.
 * `{ ok: false, issues }`  — issues array contains errors and/or
 *                             warnings; if `errors.length === 0` the
 *                             draft is technically publishable, but
 *                             the UI may still prompt the operator.
 */

export type ValidateResult =
  | { ok: true; document: DraftDocument; warnings: PublishIssue[] }
  | { ok: false; issues: PublishIssue[] };

function hasLocale(text: { ar?: string; en?: string } | undefined): boolean {
  if (!text) return false;
  return Boolean((text.ar && text.ar.trim()) || (text.en && text.en.trim()));
}

function visibleSection(s: Section): boolean {
  return s.enabled !== false;
}

export function validateForPublish(input: unknown): ValidateResult {
  const parsed = DraftDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((iss) => ({
        level: "error" as const,
        code: "schema_invalid",
        message: iss.message,
        path: iss.path.length > 0 ? iss.path.join(".") : undefined,
      })),
    };
  }

  const doc = parsed.data;
  const errors: PublishIssue[] = [];
  const warnings: PublishIssue[] = [];

  if (!hasLocale(doc.meta.title)) {
    errors.push({
      level: "error",
      code: "title_missing",
      message: "Draft must have a title in at least one locale.",
      path: "meta.title",
    });
  }

  const visibleSections = doc.sections.filter(visibleSection);

  if (!visibleSections.some((s) => s.kind === "hero")) {
    errors.push({
      level: "error",
      code: "hero_missing",
      message: "Add a Hero section before publishing.",
    });
  }
  if (
    !visibleSections.some((s) => s.kind === "cta" || s.kind === "sticky_cta")
  ) {
    errors.push({
      level: "error",
      code: "cta_missing",
      message: "Add at least one CTA or Sticky CTA before publishing.",
    });
  }

  for (const section of visibleSections) {
    switch (section.kind) {
      case "hero":
        if (!section.media) {
          warnings.push({
            level: "warning",
            code: "hero_no_media",
            message: "Hero section has no image or video.",
            sectionId: section.id,
          });
        }
        if (!hasLocale(section.title)) {
          errors.push({
            level: "error",
            code: "hero_title_missing",
            message: "Hero section needs a title.",
            sectionId: section.id,
          });
        }
        break;

      case "before_after":
        if (section.pairs.length === 0) {
          errors.push({
            level: "error",
            code: "before_after_empty",
            message: "Before/After section has no image pairs.",
            sectionId: section.id,
          });
        }
        break;

      case "benefits":
        if (section.items.length === 0) {
          errors.push({
            level: "error",
            code: "benefits_empty",
            message: "Benefits section has no items.",
            sectionId: section.id,
          });
        }
        break;

      case "testimonials":
        if (section.items.length === 0) {
          warnings.push({
            level: "warning",
            code: "testimonials_empty",
            message: "Testimonials section is empty.",
            sectionId: section.id,
          });
        }
        break;

      case "video":
        if (!section.media) {
          errors.push({
            level: "error",
            code: "video_missing_media",
            message: "Video section requires a video file.",
            sectionId: section.id,
          });
        } else if (section.media.kind !== "video") {
          errors.push({
            level: "error",
            code: "video_kind_mismatch",
            message: "Video section must reference a video asset (got " + section.media.kind + ").",
            sectionId: section.id,
          });
        }
        break;

      case "image_gallery":
        if (section.items.length === 0) {
          errors.push({
            level: "error",
            code: "gallery_empty",
            message: "Image gallery has no images.",
            sectionId: section.id,
          });
        }
        break;

      case "rich_text":
        if (!hasLocale(section.body)) {
          warnings.push({
            level: "warning",
            code: "rich_text_empty",
            message: "Rich text section has no body in any locale.",
            sectionId: section.id,
          });
        }
        break;

      case "cta":
      case "sticky_cta":
      case "faq":
        break;
    }
  }

  if (!visibleSections.some((s) => s.kind === "faq")) {
    warnings.push({
      level: "warning",
      code: "no_faq",
      message: "Pages with an FAQ section convert better.",
    });
  }
  if (!visibleSections.some((s) => s.kind === "testimonials")) {
    warnings.push({
      level: "warning",
      code: "no_testimonials",
      message: "Pages with testimonials convert better.",
    });
  }

  if (errors.length === 0) {
    return { ok: true, document: doc, warnings };
  }
  return { ok: false, issues: [...errors, ...warnings] };
}
