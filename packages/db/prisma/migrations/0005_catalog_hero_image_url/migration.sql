-- M12 / Step 2 — image fix — durable hero image URL on the catalog row.
--
-- This migration is PURELY ADDITIVE:
--   • Adds ONE nullable column (`hero_image_url`) to the existing
--     `storefront_catalog_product` table.
--
-- It does NOT touch any other table, column, index, or constraint.
-- Existing rows continue to satisfy every constraint because the new
-- column is nullable with no default — every prior row reads back as
-- `hero_image_url = NULL`, which the storefront treats as "no hero
-- image, fall back to the placeholder/snapshot".
--
-- The column stores a durable, publicly-servable image URL (CDN)
-- re-hosted from the AI pipeline's ephemeral vendor URL during the
-- Studio publish flow. fanaa's hybrid catalog loader reads it directly
-- (the table is the only DB surface fanaa queries for AI products).

ALTER TABLE "storefront_catalog_product"
  ADD COLUMN IF NOT EXISTS "hero_image_url" VARCHAR(2048);
