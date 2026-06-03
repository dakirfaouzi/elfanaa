-- Dedicated product selector for the 99-SAR post-purchase upsell offer.
--
-- This migration is PURELY ADDITIVE:
--   • Adds ONE nullable column (`post_purchase_upsell_id`) to the existing
--     `storefront_catalog_product` table.
--
-- It does NOT touch any other table, column, index, or constraint. Existing
-- rows read back as `post_purchase_upsell_id = NULL`, which the storefront
-- treats as "no dedicated post-purchase product — use the scoring heuristic".
--
-- The column stores a single product reference (id / slug) that controls ONLY
-- the product shown in the 99-SAR post-purchase offer, independently from
-- `upsell_ids` (the PDP / cart / thank-you recommendation pool). Resolved
-- id-or-slug on the loader side (no FK — it may point at another AI row).

ALTER TABLE "storefront_catalog_product"
  ADD COLUMN IF NOT EXISTS "post_purchase_upsell_id" VARCHAR(120);
