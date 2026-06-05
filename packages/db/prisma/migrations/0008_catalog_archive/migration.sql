-- Catalog lifecycle — archive foundation (Catalog Management PR B).
--
-- This migration is PURELY ADDITIVE:
--   • Adds THREE nullable columns to the existing
--     `storefront_catalog_product` table:
--       - `archived_at`     (timestamp)  — non-null = archived.
--       - `archived_reason` (varchar 280)
--       - `archived_by`     (varchar 160)
--   • Adds ONE index on (`store_id`, `archived_at`) to power the loader's
--     "which slugs are archived?" lookup cheaply.
--
-- It does NOT touch any other table, column, constraint, or existing index.
-- Every prior row reads back as `archived_at = NULL` (i.e. LIVE), so behaviour
-- is unchanged until an operator archives a product.
--
-- Lifecycle contract:
--   • ARCHIVE sets `archived_at = now()` AND `is_live = false`. Keeping
--     `is_live = false` means the FastAPI re-pricer (which filters
--     `WHERE is_live = TRUE`) excludes archived products with no code change.
--   • For a curated product with no prior row, ARCHIVE writes a TOMBSTONE row
--     (empty commerce + `archived_at`) so the hybrid loader can skip the
--     build-time snapshot.
--   • RESTORE clears `archived_at` back to NULL and flips `is_live = true`.

ALTER TABLE "storefront_catalog_product"
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archived_reason" VARCHAR(280),
  ADD COLUMN IF NOT EXISTS "archived_by" VARCHAR(160);

CREATE INDEX IF NOT EXISTS "storefront_catalog_product_store_id_archived_at_idx"
  ON "storefront_catalog_product" ("store_id", "archived_at");
