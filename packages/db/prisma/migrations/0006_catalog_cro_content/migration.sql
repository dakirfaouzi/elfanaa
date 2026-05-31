-- Step 4 / Phase 4.2 — CRO content projection on the catalog row.
--
-- This migration is PURELY ADDITIVE:
--   • Adds ONE nullable JSONB column (`cro_content`) to the existing
--     `storefront_catalog_product` table.
--
-- It does NOT touch any other table, column, index, or constraint.
-- Existing rows continue to satisfy every constraint because the new
-- column is nullable with no default — every prior row reads back as
-- `cro_content = NULL`, which the storefront treats as "no AI sections,
-- fall back to the commerce-only / snapshot product".
--
-- The column stores the conversion-content projection derived from the AI
-- pipeline's UniversalProduct (benefits, mechanism, ingredients, results,
-- guarantee, comparison, objections, founder's note, gallery, sectionOrder),
-- written during the Studio publish flow. fanaa's hybrid catalog loader reads
-- it directly and validates it via @platform/catalog-schema's CroContentSchema.

ALTER TABLE "storefront_catalog_product"
  ADD COLUMN IF NOT EXISTS "cro_content" JSONB;
