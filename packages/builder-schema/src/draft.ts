import { z } from "zod";
import { SectionSchema } from "./sections";
import { CatalogMetadataSchema } from "./catalog-metadata";

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
  /**
   * Commerce metadata — operator-editable shape upserted into
   * `storefront_catalog_product` on publish (M12 / Step 2 / Phase 2.3).
   *
   * # Why optional
   *
   * Drafts created before Phase 2.3 don't carry this field. The
   * persistence layer's `coerceDocument` (see
   * `apps/studio/lib/studio/drafts-service.ts`) feeds those drafts
   * through `DraftDocumentSchema.safeParse`, which must still
   * succeed. The catalog metadata field is synthesised on the next
   * save via the productToDraftDocument auto-derivation; until
   * then the publish flow skips the catalog upsert.
   *
   * # Why top-level instead of nested under meta
   *
   * `meta` carries SEO-facing fields (title, slug, description,
   * ogImage, keywords). `catalogMetadata` carries commerce data
   * (price, SKU, badges, taxonomy, scarcity). These are two
   * orthogonal concerns with two different downstream consumers
   * (the runtime renderer reads `meta`; the storefront catalog
   * loader reads commerce metadata). Keeping them as sibling
   * top-level fields makes the audit clean and lets the reducer
   * mutate one without churning the other's history snapshot.
   */
  catalogMetadata: CatalogMetadataSchema.optional(),
  /**
   * CRO content projection (Step 4 Phase 4.2). A DERIVED bag — not
   * operator-edited canvas state — produced by `productToDraftDocument` from
   * the pipeline's `UniversalProduct` (headline/benefits/reviews/faq/ingredients
   * /sectionContent/sectionOrder/foundersNote/images). It rides the draft so it
   * survives draft → publish, where it is projected into
   * `storefront_catalog_product.cro_content` and read by the fanaa PDP.
   *
   * Carried as an opaque JSON bag (like offerTiers/badges/rating) so
   * builder-schema stays decoupled from catalog-schema; the storefront
   * validates it with `@platform/catalog-schema`'s `CroContentSchema` at the
   * read boundary and ignores it on failure.
   */
  croContent: z.record(z.string(), z.unknown()).optional(),
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
