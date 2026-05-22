-- ────────────────────────────────────────────────────────────────────────────
-- M10 — Studio platform tables (PLATFORM.md §13).
--
-- Pure-additive migration. Adds 7 tables + 4 enums under the `studio_*`
-- namespace. Does NOT touch the existing analytics schema (visitor,
-- session, event, order_mirror, traffic_quality, admin_audit) or any
-- SQLAlchemy-owned tables.
--
-- pgvector NOT enabled at this migration. The embedding column on
-- StudioAsset lands with M12 (upsell-match).
-- ────────────────────────────────────────────────────────────────────────────

-- CreateEnum
CREATE TYPE "studio_store_status" AS ENUM ('live', 'incubating', 'archived');

-- CreateEnum
CREATE TYPE "studio_draft_status" AS ENUM ('intake', 'generating', 'ready', 'publishing', 'published', 'archived', 'failed');

-- CreateEnum
CREATE TYPE "studio_run_status" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "studio_step_status" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "studio_asset_source" AS ENUM ('upload', 'scraped', 'generated');

-- CreateTable
CREATE TABLE "studio_store" (
    "id" VARCHAR(64) NOT NULL,
    "display_name" VARCHAR(160) NOT NULL,
    "status" "studio_store_status" NOT NULL DEFAULT 'live',
    "config_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_draft" (
    "id" VARCHAR(64) NOT NULL,
    "store_id" VARCHAR(64) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "supplier_url" VARCHAR(2048),
    "notes" TEXT,
    "positioning" TEXT,
    "status" "studio_draft_status" NOT NULL DEFAULT 'intake',
    "template" VARCHAR(80) NOT NULL,
    "cost_cents" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "published_ref" VARCHAR(120),
    "created_by" VARCHAR(160) NOT NULL DEFAULT 'system',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_run" (
    "id" VARCHAR(64) NOT NULL,
    "draft_id" VARCHAR(64) NOT NULL,
    "run_id" VARCHAR(120) NOT NULL,
    "inngest_run_id" VARCHAR(120),
    "status" "studio_run_status" NOT NULL DEFAULT 'queued',
    "cost_cents" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "error_message" TEXT,
    "input_snapshot" JSONB NOT NULL,

    CONSTRAINT "studio_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_step" (
    "id" VARCHAR(64) NOT NULL,
    "run_id" VARCHAR(64) NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "status" "studio_step_status" NOT NULL DEFAULT 'pending',
    "provider_id" VARCHAR(40),
    "input_hash" VARCHAR(64),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "cost_cents" INTEGER NOT NULL DEFAULT 0,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "latency_ms" INTEGER,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "error_message" TEXT,
    "error_kind" VARCHAR(40),
    "output" JSONB,

    CONSTRAINT "studio_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_artifact" (
    "id" VARCHAR(64) NOT NULL,
    "draft_id" VARCHAR(64) NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "locale" VARCHAR(8),
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "payload" JSONB NOT NULL,
    "generated_by_step_id" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_asset" (
    "id" VARCHAR(64) NOT NULL,
    "draft_id" VARCHAR(64) NOT NULL,
    "source" "studio_asset_source" NOT NULL,
    "r2_bucket" VARCHAR(160) NOT NULL,
    "r2_key" VARCHAR(512) NOT NULL,
    "content_type" VARCHAR(80) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "alt_ar" VARCHAR(512),
    "alt_en" VARCHAR(512),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_event" (
    "id" VARCHAR(64) NOT NULL,
    "store_id" VARCHAR(64),
    "draft_id" VARCHAR(64),
    "kind" VARCHAR(60) NOT NULL,
    "actor" VARCHAR(160) NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_store_status_idx" ON "studio_store"("status");

-- CreateIndex
CREATE UNIQUE INDEX "studio_draft_store_id_slug_key" ON "studio_draft"("store_id", "slug");

-- CreateIndex
CREATE INDEX "studio_draft_store_id_status_idx" ON "studio_draft"("store_id", "status");

-- CreateIndex
CREATE INDEX "studio_draft_created_at_idx" ON "studio_draft"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "studio_run_run_id_key" ON "studio_run"("run_id");

-- CreateIndex
CREATE INDEX "studio_run_draft_id_idx" ON "studio_run"("draft_id");

-- CreateIndex
CREATE INDEX "studio_run_status_idx" ON "studio_run"("status");

-- CreateIndex
CREATE INDEX "studio_run_run_id_idx" ON "studio_run"("run_id");

-- CreateIndex
CREATE INDEX "studio_step_run_id_kind_idx" ON "studio_step"("run_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "studio_artifact_draft_id_kind_locale_version_key" ON "studio_artifact"("draft_id", "kind", "locale", "version");

-- CreateIndex
CREATE INDEX "studio_artifact_draft_id_is_current_idx" ON "studio_artifact"("draft_id", "is_current");

-- CreateIndex
CREATE UNIQUE INDEX "studio_asset_r2_key_key" ON "studio_asset"("r2_key");

-- CreateIndex
CREATE INDEX "studio_asset_draft_id_source_idx" ON "studio_asset"("draft_id", "source");

-- CreateIndex
CREATE INDEX "studio_event_store_id_kind_created_at_idx" ON "studio_event"("store_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "studio_event_draft_id_created_at_idx" ON "studio_event"("draft_id", "created_at");

-- AddForeignKey
ALTER TABLE "studio_draft" ADD CONSTRAINT "studio_draft_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "studio_store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_run" ADD CONSTRAINT "studio_run_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "studio_draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_step" ADD CONSTRAINT "studio_step_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "studio_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_artifact" ADD CONSTRAINT "studio_artifact_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "studio_draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_asset" ADD CONSTRAINT "studio_asset_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "studio_draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_event" ADD CONSTRAINT "studio_event_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "studio_store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
