import type { UniversalProduct } from "@platform/catalog-schema";
import type { IngestJob } from "../jobs";

/**
 * Run / step persistence contract (PLATFORM.md §13 "Step results").
 *
 * # Why a contract instead of a Prisma table
 *
 * The Studio storage strategy is "Postgres in the long run, files now"
 * (PLATFORM.md §13 → M10). M6 ships file-backed persistence so the
 * worker can run end-to-end locally without a database. The Prisma-
 * backed implementation drops in behind the same `RunStore` interface
 * in M10 with zero worker changes.
 *
 * # What a "run" is
 *
 * A run = one execution of the 11-stage pipeline for one IngestJob.
 * Each stage produces a `StepRecord`; the orchestrator appends them
 * as it runs. The final stage's output (the UniversalProduct) is
 * stored on the `RunRecord` as `finalProduct` for easy retrieval.
 *
 * # Cost attribution
 *
 * Provider calls record one `CostRow` per call (CostRecorder wraps
 * each provider in the worker). The RunStore aggregates them onto
 * the run's `totalCostUsd`. The publisher (M7) is responsible for
 * comparing this to `StoreConfig.costCeilingPerDraftUsd` before
 * publishing.
 */

export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/** Stage execution record — one per executed pipeline stage. */
export interface StepRecord {
  /** Stage name (matches the M5 pipeline function name). */
  stage: string;
  status: "success" | "failed" | "skipped";
  /** ISO-8601. */
  startedAt: string;
  /** ISO-8601. */
  finishedAt: string;
  durationMs: number;
  /** Total attempts within this run (1 = first try). Distinct from
   *  the queue-level attempts counter. */
  attempts: number;
  /** Sum of all provider calls' `costUsd` during this stage. */
  costUsd: number;
  /** Stage output, JSON-serialisable. Absent on `failed`. */
  output?: unknown;
  /** Failure summary when `status === "failed"`. */
  errorMessage?: string;
  /** PipelineError.kind when applicable (`validation_failed` /
   *  `provider_error` / `precondition_failed`). */
  errorKind?: string;
}

/** Provider-call-level cost row. */
export interface CostRow {
  runId: string;
  /** Stage that triggered the call (`research`, `vision`, …). */
  stage: string;
  /** Capability (`text` / `vision` / `image` / `scraper` / `embedding`). */
  capability: string;
  providerId: string;
  model?: string;
  costUsd: number;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs: number;
  /** ISO-8601. */
  timestamp: string;
}

/** Run record — the orchestrator's view of one job execution. */
export interface RunRecord {
  runId: string;
  storeId: string;
  status: RunStatus;
  job: IngestJob;
  steps: StepRecord[];
  costs: CostRow[];
  totalCostUsd: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  finalProduct?: UniversalProduct;
  errorMessage?: string;
}

export interface ListRunsFilter {
  storeId?: string;
  status?: RunStatus;
  /** Default 50. Hard cap 1000 — implementations should clamp. */
  limit?: number;
}

/**
 * RunStore — the persistence contract.
 *
 * The worker only ever talks to a RunStore. Implementations:
 *   • `MemoryStore`  — in-process, tests only.
 *   • `FileStore`    — one JSON file per run, local dev.
 *   • `PrismaStore`  — M10+, backed by Postgres.
 */
export interface RunStore {
  /** Idempotent: re-calling with the same `runId` overwrites pending state. */
  createRun(record: NewRunRecord): Promise<RunRecord>;
  /** Marks the run `running` and sets `startedAt`. */
  markRunStarted(runId: string): Promise<void>;
  /** Append a step record to the run. */
  appendStep(runId: string, step: StepRecord): Promise<void>;
  /** Append cost rows from a step's provider calls. */
  appendCosts(runId: string, costs: CostRow[]): Promise<void>;
  /** Finalise run with the assembled UniversalProduct. */
  markRunComplete(
    runId: string,
    finalProduct: UniversalProduct,
  ): Promise<void>;
  /** Finalise run with a failure summary. */
  markRunFailed(runId: string, errorMessage: string): Promise<void>;
  /** Get one run by ID. Returns null when not found. */
  getRun(runId: string): Promise<RunRecord | null>;
  /** List runs ordered most-recent-first. */
  listRuns(filter?: ListRunsFilter): Promise<RunRecord[]>;
}

/** Constructor args for `RunStore.createRun()`. */
export interface NewRunRecord {
  runId: string;
  job: IngestJob;
  createdAt: string;
}
