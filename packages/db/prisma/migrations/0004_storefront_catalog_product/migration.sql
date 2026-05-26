-- M12 / Step 2 — Phase 2.1 — DB-backed storefront catalog table.
--
-- This migration is PURELY ADDITIVE:
--   • Creates one new enum (`product_source_kind`).
--   • Creates one new table (`storefront_catalog_product`).
--   • Adds four indexes (one unique, three non-unique).
--   • Adds one foreign key to `studio_store`.
--
-- It does NOT touch any existing table, column, index, or constraint.
-- Existing rows in every prior table continue to satisfy every
-- constraint they did before because nothing existing is modified.
--
-- The new table is the source of truth for storefront *commerce*
-- metadata (price, SKU, collection, badges, target, problems, upsells,
-- landing-path overrides). It deliberately sits alongside
-- `studio_published_product`, which remains the source of truth for the
-- published *document*. Curated products land here with no
-- `published_product_id`; AI-generated publishes land here paired to
-- their snapshot via `published_product_id`.

-- ── product_source_kind enum ─────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_source_kind') THEN
    CREATE TYPE "product_source_kind" AS ENUM ('curated', 'ai_generated');
  END IF;
END
$$;

-- ── storefront_catalog_product table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS "storefront_catalog_product" (
  "id"                    VARCHAR(64)            PRIMARY KEY,
  "store_id"              VARCHAR(64)            NOT NULL,
  "slug"                  VARCHAR(120)           NOT NULL,
  "source"                "product_source_kind"  NOT NULL DEFAULT 'curated',
  "published_product_id"  VARCHAR(64),
  "sku"                   VARCHAR(80),
  "price_minor"           INTEGER                NOT NULL,
  "price_currency"        VARCHAR(3)             NOT NULL,
  "offer_tiers"           JSONB,
  "collection"            VARCHAR(80),
  "product_type"          VARCHAR(80),
  "target"                VARCHAR(40),
  "problems"              TEXT[]                 NOT NULL DEFAULT ARRAY[]::TEXT[],
  "badges"                JSONB,
  "rating"                JSONB,
  "stock_left"            INTEGER,
  "recent_buyers"         INTEGER,
  "upsell_ids"            TEXT[]                 NOT NULL DEFAULT ARRAY[]::TEXT[],
  "landing_path"          VARCHAR(160),
  "is_live"               BOOLEAN                NOT NULL DEFAULT TRUE,
  "created_at"            TIMESTAMP              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "storefront_catalog_product_store_fk"
    FOREIGN KEY ("store_id") REFERENCES "studio_store"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "storefront_catalog_product_store_slug_uq"
  ON "storefront_catalog_product" ("store_id", "slug");

CREATE INDEX IF NOT EXISTS "storefront_catalog_product_store_live_idx"
  ON "storefront_catalog_product" ("store_id", "is_live");

CREATE INDEX IF NOT EXISTS "storefront_catalog_product_store_collection_idx"
  ON "storefront_catalog_product" ("store_id", "collection");

CREATE INDEX IF NOT EXISTS "storefront_catalog_product_published_product_idx"
  ON "storefront_catalog_product" ("published_product_id");
