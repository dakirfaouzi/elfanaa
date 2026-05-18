-- =====================================================================
-- Fanaa Admin — analytics schema (idempotent startup migration).
-- =====================================================================
-- Mirror of `prisma/schema.prisma`. Executed by FastAPI's lifespan on every
-- boot (same architecture as the orders `Base.metadata.create_all()`).
--
-- Rules for editing:
--   • Every CREATE statement MUST be `IF NOT EXISTS`.
--   • Every ALTER ... ADD CONSTRAINT MUST be wrapped in a DO block that
--     swallows `duplicate_object` so re-runs are safe.
--   • Schema changes MUST be added at the bottom as a new `-- v<N> ...`
--     block guarded by a `_admin_schema_version` check.
--
-- Source of truth for the Prisma client lives in `prisma/schema.prisma`;
-- keep both in sync when adding columns.

-- ── Version tracking ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "_admin_schema_version" (
    "version"     INTEGER     NOT NULL PRIMARY KEY,
    "applied_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── v1 — initial schema ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "visitor" (
    "id"             VARCHAR(36) NOT NULL,
    "first_seen"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_sessions" INTEGER     NOT NULL DEFAULT 1,
    "total_orders"   INTEGER     NOT NULL DEFAULT 0,
    "total_revenue"  BIGINT      NOT NULL DEFAULT 0,
    "country"        VARCHAR(2),
    "city"           VARCHAR(80),
    "first_source"   VARCHAR(40),
    "first_landing"  VARCHAR(255),
    CONSTRAINT "visitor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "session" (
    "id"            VARCHAR(36)  NOT NULL,
    "visitor_id"    VARCHAR(36)  NOT NULL,
    "started_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at"      TIMESTAMP(3),
    "landing_path"  VARCHAR(255),
    "referrer"      VARCHAR(500),
    "utm_source"    VARCHAR(80),
    "utm_medium"    VARCHAR(80),
    "utm_campaign"  VARCHAR(120),
    "device"        VARCHAR(20),
    "browser"       VARCHAR(40),
    "os"            VARCHAR(40),
    "country_code"  VARCHAR(2),
    "region"        VARCHAR(80),
    "city"          VARCHAR(80),
    "isp"           VARCHAR(120),
    "ip_hash"       VARCHAR(64),
    "ua_hash"       VARCHAR(64),
    "is_bot"        BOOLEAN      NOT NULL DEFAULT false,
    "is_vpn"        BOOLEAN      NOT NULL DEFAULT false,
    "is_proxy"      BOOLEAN      NOT NULL DEFAULT false,
    "is_tor"        BOOLEAN      NOT NULL DEFAULT false,
    "is_hosting"    BOOLEAN      NOT NULL DEFAULT false,
    "is_gcc"        BOOLEAN      NOT NULL DEFAULT false,
    "is_valid"      BOOLEAN      NOT NULL DEFAULT true,
    "quality_score" INTEGER      NOT NULL DEFAULT 100,
    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "event" (
    "id"           BIGSERIAL    NOT NULL,
    "ts"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_id"   VARCHAR(36),
    "visitor_id"   VARCHAR(36),
    "name"         VARCHAR(40)  NOT NULL,
    "path"         VARCHAR(255),
    "product_id"   VARCHAR(40),
    "product_slug" VARCHAR(80),
    "surface"      VARCHAR(40),
    "value_minor"  BIGINT,
    "currency"     VARCHAR(3),
    "meta"         JSONB,
    "country_code" VARCHAR(2),
    "city"         VARCHAR(80),
    "device"       VARCHAR(20),
    "is_valid"     BOOLEAN      NOT NULL DEFAULT true,
    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "order_mirror" (
    "id"             VARCHAR(40)  NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_id"     VARCHAR(36),
    "visitor_id"     VARCHAR(36),
    "customer_name"  VARCHAR(160) NOT NULL,
    "phone"          VARCHAR(40)  NOT NULL,
    "phone_e164"     VARCHAR(40),
    "city"           VARCHAR(80),
    "address"        VARCHAR(255),
    "country_code"   VARCHAR(2),
    "locale"         VARCHAR(8),
    "payment_method" VARCHAR(20)  NOT NULL DEFAULT 'cod',
    "status"         VARCHAR(24)  NOT NULL DEFAULT 'pending',
    "subtotal_minor" BIGINT       NOT NULL,
    "total_minor"    BIGINT       NOT NULL,
    "currency"       VARCHAR(3)   NOT NULL,
    "item_count"     INTEGER      NOT NULL DEFAULT 0,
    "has_upsell"     BOOLEAN      NOT NULL DEFAULT false,
    "has_cross_sell" BOOLEAN      NOT NULL DEFAULT false,
    "source_path"    VARCHAR(255),
    "device"         VARCHAR(20),
    "ip_hash"        VARCHAR(64),
    "raw_payload"    JSONB        NOT NULL,
    "notes"          TEXT,
    CONSTRAINT "order_mirror_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "order_mirror_item" (
    "id"           BIGSERIAL    NOT NULL,
    "order_id"     VARCHAR(40)  NOT NULL,
    "product_id"   VARCHAR(40)  NOT NULL,
    "product_slug" VARCHAR(80),
    "title"        VARCHAR(160) NOT NULL,
    "quantity"     INTEGER      NOT NULL DEFAULT 1,
    "unit_minor"   BIGINT       NOT NULL,
    "total_minor"  BIGINT       NOT NULL,
    "source"       VARCHAR(20)  NOT NULL DEFAULT 'base',
    CONSTRAINT "order_mirror_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "traffic_quality" (
    "session_id"       VARCHAR(36)  NOT NULL,
    "evaluated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score"            INTEGER      NOT NULL DEFAULT 100,
    "is_vpn"           BOOLEAN      NOT NULL DEFAULT false,
    "is_proxy"         BOOLEAN      NOT NULL DEFAULT false,
    "is_tor"           BOOLEAN      NOT NULL DEFAULT false,
    "is_hosting"       BOOLEAN      NOT NULL DEFAULT false,
    "is_bot"           BOOLEAN      NOT NULL DEFAULT false,
    "is_duplicate"     BOOLEAN      NOT NULL DEFAULT false,
    "is_anonymous"     BOOLEAN      NOT NULL DEFAULT false,
    "country_mismatch" BOOLEAN      NOT NULL DEFAULT false,
    "ua_suspicious"    BOOLEAN      NOT NULL DEFAULT false,
    "flags"            JSONB,
    "reason"           VARCHAR(255),
    CONSTRAINT "traffic_quality_pkey" PRIMARY KEY ("session_id")
);

CREATE TABLE IF NOT EXISTS "admin_audit" (
    "id"      BIGSERIAL    NOT NULL,
    "ts"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email"   VARCHAR(160) NOT NULL,
    "action"  VARCHAR(40)  NOT NULL,
    "ip_hash" VARCHAR(64),
    "ua"      VARCHAR(255),
    CONSTRAINT "admin_audit_pkey" PRIMARY KEY ("id")
);

-- ── Indexes (IF NOT EXISTS — safe to re-run) ──────────────────────────────
CREATE INDEX IF NOT EXISTS "visitor_last_seen_idx"        ON "visitor"("last_seen");
CREATE INDEX IF NOT EXISTS "visitor_country_idx"          ON "visitor"("country");

CREATE INDEX IF NOT EXISTS "session_started_at_idx"             ON "session"("started_at");
CREATE INDEX IF NOT EXISTS "session_visitor_id_idx"             ON "session"("visitor_id");
CREATE INDEX IF NOT EXISTS "session_is_valid_started_at_idx"    ON "session"("is_valid", "started_at");
CREATE INDEX IF NOT EXISTS "session_country_code_idx"           ON "session"("country_code");

CREATE INDEX IF NOT EXISTS "event_ts_idx"                ON "event"("ts");
CREATE INDEX IF NOT EXISTS "event_name_ts_idx"           ON "event"("name", "ts");
CREATE INDEX IF NOT EXISTS "event_session_id_idx"        ON "event"("session_id");
CREATE INDEX IF NOT EXISTS "event_visitor_id_idx"        ON "event"("visitor_id");
CREATE INDEX IF NOT EXISTS "event_product_id_ts_idx"     ON "event"("product_id", "ts");
CREATE INDEX IF NOT EXISTS "event_is_valid_ts_idx"       ON "event"("is_valid", "ts");

CREATE INDEX IF NOT EXISTS "order_mirror_created_at_idx"   ON "order_mirror"("created_at");
CREATE INDEX IF NOT EXISTS "order_mirror_visitor_id_idx"   ON "order_mirror"("visitor_id");
CREATE INDEX IF NOT EXISTS "order_mirror_country_code_idx" ON "order_mirror"("country_code");
CREATE INDEX IF NOT EXISTS "order_mirror_status_idx"       ON "order_mirror"("status");

CREATE INDEX IF NOT EXISTS "order_mirror_item_order_id_idx"   ON "order_mirror_item"("order_id");
CREATE INDEX IF NOT EXISTS "order_mirror_item_product_id_idx" ON "order_mirror_item"("product_id");

CREATE INDEX IF NOT EXISTS "traffic_quality_evaluated_at_idx" ON "traffic_quality"("evaluated_at");
CREATE INDEX IF NOT EXISTS "admin_audit_ts_idx"               ON "admin_audit"("ts");

-- ── Foreign keys (wrapped — no IF NOT EXISTS for ALTER...ADD CONSTRAINT) ──
-- Each block is a no-op once the constraint exists.

DO $$ BEGIN
    ALTER TABLE "session"
        ADD CONSTRAINT "session_visitor_id_fkey"
        FOREIGN KEY ("visitor_id") REFERENCES "visitor"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "event"
        ADD CONSTRAINT "event_session_id_fkey"
        FOREIGN KEY ("session_id") REFERENCES "session"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "event"
        ADD CONSTRAINT "event_visitor_id_fkey"
        FOREIGN KEY ("visitor_id") REFERENCES "visitor"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "order_mirror"
        ADD CONSTRAINT "order_mirror_session_id_fkey"
        FOREIGN KEY ("session_id") REFERENCES "session"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "order_mirror"
        ADD CONSTRAINT "order_mirror_visitor_id_fkey"
        FOREIGN KEY ("visitor_id") REFERENCES "visitor"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "order_mirror_item"
        ADD CONSTRAINT "order_mirror_item_order_id_fkey"
        FOREIGN KEY ("order_id") REFERENCES "order_mirror"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "traffic_quality"
        ADD CONSTRAINT "traffic_quality_session_id_fkey"
        FOREIGN KEY ("session_id") REFERENCES "session"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Mark v1 applied (idempotent — ON CONFLICT keeps original timestamp) ──
INSERT INTO "_admin_schema_version" ("version") VALUES (1) ON CONFLICT DO NOTHING;

-- =====================================================================
-- Adding a future schema bump? Append a new block here. Example template:
--
-- DO $$ BEGIN
--   IF NOT EXISTS (SELECT 1 FROM "_admin_schema_version" WHERE "version" = 2) THEN
--     -- ... your idempotent ALTERs / CREATEs ...
--     INSERT INTO "_admin_schema_version" ("version") VALUES (2);
--   END IF;
-- END $$;
-- =====================================================================
