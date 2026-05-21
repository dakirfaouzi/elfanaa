import { z } from "zod";
import type { Money, StoreId } from "@platform/catalog-schema";
import { MoneySchema } from "@platform/catalog-schema/schemas";

/**
 * Ingest job — the dispatch payload that initiates a Studio pipeline
 * run (PLATFORM.md §11 stage 01 "Intake" output, §15 queue dispatch).
 *
 * An IngestJob is the SOLE input shape the worker accepts. The M8
 * Studio API route validates an operator's intake form into an
 * IngestJob, enqueues it via `Queue.enqueue()`, and returns the
 * `runId` to the client for SSE-progress polling. M6 ships the
 * contract; the Studio route lands in M8.
 *
 * # Why a Zod schema in the contract package
 *
 * The queue boundary is the trust boundary: anything that crosses the
 * queue is potentially deserialised from disk / Inngest / etc. Validate
 * once at the boundary, then operate on typed data inside the worker.
 * The schema also documents the contract for future cross-language
 * callers (e.g. an n8n webhook in M12).
 *
 * # Why ImageRef inputs aren't typed via @platform/ai-engine
 *
 * Avoids a workspace-dep cycle (`@platform/ingest` cannot depend on
 * `@platform/ai-engine` if the worker depends on both). The ingest job
 * declares a structural copy of the ImageRef shape (`src` string +
 * optional `alt`); the worker re-types it on the way into the M5
 * pipeline. The two shapes MUST stay aligned — if you change
 * `ImageRef` in ai-engine you change it here too.
 */
export interface IngestJob {
  /** Stable run identifier; the orchestrator uses this everywhere. */
  runId: string;

  /** Target store. Drives StoreConfig resolution at the worker. */
  storeId: StoreId;

  /** Supplier URL (Alibaba / AliExpress / etc.) — research stage input. */
  supplierUrl: string;

  /** 0..10 operator-uploaded images. Resolved at the worker:
   *   • R2 keys (`stores/fanaa/runs/<runId>/img/01.jpg`) post-M7
   *   • absolute https URLs in M6 (no R2 wired yet) */
  uploadedImages: IngestImageRef[];

  /** Operator-provided unit price hint. The publisher decides offer structure. */
  priceHint: Money;

  /** Operator notes (free-form positioning hints). Passed to strategy stage. */
  operatorNotes?: string;

  /** Operator-internal margin breakdown ("supplier $4.20 + ship $1.80").
   *  Never customer-facing. Passed to assemble stage. */
  marginNotes?: string;

  /** Operator opt-out: skip the supplier-page scrape entirely. */
  skipResearch?: boolean;

  /** ISO timestamp of when the job was created (intake server clock). */
  createdAt: string;
}

export interface IngestImageRef {
  /** R2 key OR absolute https URL. */
  src: string;
  alt?: string;
}

const IngestImageRefSchema: z.ZodType<IngestImageRef> = z.object({
  src: z.string().min(1),
  alt: z.string().optional(),
});

/**
 * Runtime validator. Use this at every trust boundary (queue read,
 * file-backed store read, HTTP body parse). The `runId` regex is loose
 * — callers may pick their own ID scheme — but it must be URL/path-
 * safe because FileQueue and FileStore both use it as a file name.
 */
export const IngestJobSchema: z.ZodType<IngestJob> = z.object({
  runId: z.string().min(1).regex(/^[A-Za-z0-9_-]+$/, "runId_must_be_url_safe"),
  storeId: z.string().min(1),
  supplierUrl: z.string().url(),
  uploadedImages: z.array(IngestImageRefSchema).min(0).max(10),
  priceHint: MoneySchema,
  operatorNotes: z.string().optional(),
  marginNotes: z.string().optional(),
  skipResearch: z.boolean().optional(),
  createdAt: z.string().min(1),
});
