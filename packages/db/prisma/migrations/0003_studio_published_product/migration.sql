-- M11 — Studio published-product table + draft payload column.
--
-- This migration is PURELY ADDITIVE:
--   • Adds two nullable columns to `studio_draft` (`payload`, `payload_version`).
--   • Creates the new `studio_published_product` table.
--   • Adds three indexes.
--
-- It DOES NOT touch any analytics table, any existing studio_* row, or
-- any column constraint. M10 rows continue to satisfy every constraint
-- they did before because the new columns are nullable / defaulted.

-- ── studio_draft additive columns ────────────────────────────────────────
ALTER TABLE "studio_draft"
  ADD COLUMN IF NOT EXISTS "payload" JSONB,
  ADD COLUMN IF NOT EXISTS "payload_version" INTEGER NOT NULL DEFAULT 0;

-- ── studio_published_product table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "studio_published_product" (
  "id"            VARCHAR(64)  PRIMARY KEY,
  "draft_id"      VARCHAR(64)  NOT NULL,
  "store_id"      VARCHAR(64)  NOT NULL,
  "slug"          VARCHAR(120) NOT NULL,
  "version"       INTEGER      NOT NULL DEFAULT 1,
  "is_current"    BOOLEAN      NOT NULL DEFAULT TRUE,
  "document"      JSONB        NOT NULL,
  "published_by"  VARCHAR(160) NOT NULL DEFAULT 'system',
  "published_at"  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "studio_published_product_draft_fk"
    FOREIGN KEY ("draft_id") REFERENCES "studio_draft"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "studio_published_product_store_slug_version_uq"
  ON "studio_published_product" ("store_id", "slug", "version");

CREATE INDEX IF NOT EXISTS "studio_published_product_store_slug_current_idx"
  ON "studio_published_product" ("store_id", "slug", "is_current");

CREATE INDEX IF NOT EXISTS "studio_published_product_draft_version_idx"
  ON "studio_published_product" ("draft_id", "version");
