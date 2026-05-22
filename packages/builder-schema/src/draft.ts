import { z } from "zod";
import { SectionSchema } from "./sections";

/**
 * DraftDocument — the normalised state shape stored in
 * `studio_draft.payload` (JSONB).
 *
 * # Why this shape
 *
 * - **`sections` is an ordered array** of section objects, not a
 *   sections-by-id map. Ordering IS data here: the reducer reorders
 *   by mutating array index. We keep id-based lookups O(n) because
 *   typical drafts have <30 sections — premature optimisation would
 *   complicate the reducer and the renderer.
 *
 * - **`meta` separates store-facing fields** (title, slug, etc.)
 *   from the section list. That way the operator can edit the
 *   product title without churning the section history.
 *
 * - **`version` is a literal `1`** — when the schema evolves we'll
 *   bump it and add an upcasting helper. Until then every persisted
 *   draft MUST carry `version: 1`.
 *
 * # Slug rules
 *
 * - Lowercased ASCII letters, digits, and hyphens only.
 * - Must start and end with a letter or digit.
 * - 1–80 characters.
 * - Uniqueness is NOT enforced here (DB constraint owns that).
 */

export const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$/;

export const DraftSlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(SLUG_PATTERN, "slug_invalid");

export const DraftMetaSchema = z.object({
  /** Display title shown in /studio/drafts. Locale-pair. */
  title: z.object({
    ar: z.string().max(200).optional(),
    en: z.string().max(200).optional(),
  }),
  slug: DraftSlugSchema,
  description: z
    .object({
      ar: z.string().max(500).optional(),
      en: z.string().max(500).optional(),
    })
    .optional(),
  /** OG/social card override (image asset). When unset, the
   *  runtime renderer falls back to the first Hero media. */
  ogImage: z.string().max(2048).optional(),
  /** Tags/keywords — comma-free, max 16 entries. */
  keywords: z.array(z.string().min(1).max(64)).max(16).default([]),
});
export type DraftMeta = z.infer<typeof DraftMetaSchema>;

export const DraftStatusSchema = z.enum([
  "draft",
  "in_review",
  "published",
  "archived",
]);
export type DraftStatus = z.infer<typeof DraftStatusSchema>;

export const DraftDocumentSchema = z.object({
  version: z.literal(1),
  meta: DraftMetaSchema,
  sections: z.array(SectionSchema).max(64).default([]),
});
export type DraftDocument = z.infer<typeof DraftDocumentSchema>;

/**
 * Publish validation result — produced by `validateForPublish`
 * (in src/validation.ts). Surfaced in the UI as a checklist next
 * to the publish button.
 */
export const PublishIssueLevelSchema = z.enum(["error", "warning"]);
export type PublishIssueLevel = z.infer<typeof PublishIssueLevelSchema>;

export const PublishIssueSchema = z.object({
  level: PublishIssueLevelSchema,
  code: z.string().min(1),
  message: z.string().min(1),
  /** Dotted path inside DraftDocument when the issue is field-scoped. */
  path: z.string().optional(),
  /** Section id when the issue is section-scoped. */
  sectionId: z.string().optional(),
});
export type PublishIssue = z.infer<typeof PublishIssueSchema>;
