import type { UpsellMatchCatalogPort } from "@platform/ai-engine";
import type { UniversalProduct } from "@platform/catalog-schema";
import type {
  CostRow,
  IngestJob,
  RunRecord,
  RunStore,
  RetryPolicyTable,
} from "@platform/ingest";
import type { StoreConfig } from "@platform/stores";
import type { ResolvedProviders } from "../provider-wiring";
import type { Logger } from "./logger";

/**
 * Public types for the worker runtime.
 *
 * Two surfaces exist:
 *
 *   • `OrchestratorOptions` — what `runPipeline()` consumes.
 *   • `OrchestratorResult`   — what it returns.
 *
 * The orchestrator is intentionally NOT exposed as a class — pure
 * function call makes it trivial to unit-test, parallel-run, or
 * future-proof behind an Inngest step.
 */

export interface OrchestratorOptions {
  job: IngestJob;
  storeConfig: StoreConfig;
  /** Pre-wrapped providers (CostRecorder-decorated). Tests inject mocks. */
  providers: ResolvedProviders;
  /** Persistence layer — MemoryStore in tests, FileStore in local dev. */
  store: RunStore;
  /** Upsell catalog port. Defaults to `emptyCatalog` when omitted. */
  catalog?: UpsellMatchCatalogPort;
  /** Retry policy. Defaults to PLATFORM.md §15 table. */
  retryPolicy?: RetryPolicyTable;
  /** Logger (orchestrator decorates with runId/stage context). */
  logger?: Logger;
  /** Pre-flight: should we resume from a saved RunRecord instead of running from scratch?
   *  When set, the orchestrator reuses any successful step outputs and only re-runs
   *  failed / not-yet-attempted stages. */
  resume?: ResumePolicy;
  /** Middleware hook — invoked AFTER each step (success or failure) is
   *  persisted to the store. Used by the M9 cost-ceiling middleware to
   *  short-circuit the run when cumulative spend crosses the cap.
   *
   *  Throw a `CostCeilingExceededError` (or any Error containing the
   *  marker prefix `cost_exceeded:`) to abort the pipeline; the
   *  orchestrator marks the run as `failed` with the marker as
   *  `errorMessage` and breaks the dispatch loop without invoking
   *  further providers.
   *
   *  See `packages/worker/src/middleware/with-cost-ceiling.ts`. */
  onStepRecorded?: (ctx: StepRecordedContext) => Promise<void> | void;
}

/** Context passed to `OrchestratorOptions.onStepRecorded`. */
export interface StepRecordedContext {
  /** ID of the running pipeline. */
  runId: string;
  /** Name of the stage that just produced this step. */
  stage: PipelineStageName;
  /** Whether the step succeeded, failed, or was skipped. */
  status: "success" | "failed" | "skipped";
  /** Cost (USD) attributed to this single stage. */
  stageCostUsd: number;
  /** Cumulative cost across every step persisted so far in this run. */
  totalCostUsd: number;
  /** Configured ceiling for the run's store (USD). */
  costCeilingUsd: number;
}

/**
 * Aborts the orchestrator mid-run when the cumulative spend crosses
 * `StoreConfig.costCeilingPerDraftUsd`. The orchestrator catches this
 * specific class (instead of recognising every random Error) and
 * marks the run as `failed` with a stable `cost_exceeded:` message
 * so the Studio UI / Inngest webhook can branch on it explicitly.
 */
export class CostCeilingExceededError extends Error {
  override readonly name = "CostCeilingExceededError";
  /** Stable machine marker — embedded in `errorMessage` for callers
   *  that don't have access to the Error class (file readers, queue
   *  consumers, etc.). */
  static readonly MARKER = "cost_exceeded:" as const;
  readonly runId: string;
  readonly stage: PipelineStageName;
  readonly totalCostUsd: number;
  readonly ceilingUsd: number;
  constructor(args: {
    runId: string;
    stage: PipelineStageName;
    totalCostUsd: number;
    ceilingUsd: number;
  }) {
    const detail = `${args.totalCostUsd.toFixed(4)}>${args.ceilingUsd.toFixed(4)}_usd_at_${args.stage}`;
    super(`${CostCeilingExceededError.MARKER}${detail}`);
    this.runId = args.runId;
    this.stage = args.stage;
    this.totalCostUsd = args.totalCostUsd;
    this.ceilingUsd = args.ceilingUsd;
  }
}

export interface ResumePolicy {
  /** Persisted record to resume from. */
  prior: RunRecord;
  /** Optional: start the rerun from a specific stage onward, ignoring later persisted outputs. */
  fromStage?: PipelineStageName;
}

export interface OrchestratorResult {
  /** Updated RunRecord (also written to the store). */
  run: RunRecord;
  /** Final assembled UniversalProduct, when the run succeeded. */
  product?: UniversalProduct;
}

/** Stable list of M5 pipeline stage names — drives the orchestrator's execution order. */
export const PIPELINE_STAGES = [
  "research",
  "vision",
  "strategy",
  "structure",
  "copy",
  "creative_prompts",
  "image_gen",
  "image_post",
  "social_proof",
  "upsell_match",
  "assemble",
] as const;

export type PipelineStageName = (typeof PIPELINE_STAGES)[number];

/**
 * In-memory bag of every stage's output. Threaded through the orchestrator.
 * Stages downstream read what they need (e.g. `copy` reads `strategy +
 * structure`); the orchestrator validates inputs are present before
 * dispatching each stage.
 */
export interface StageOutputs {
  research?: import("@platform/ai-engine").ResearchOutput;
  vision?: import("@platform/ai-engine").VisionOutput;
  strategy?: import("@platform/ai-engine").StrategyOutput;
  structure?: import("@platform/ai-engine").StructureOutput;
  copy?: import("@platform/ai-engine").CopyOutput;
  creative_prompts?: import("@platform/ai-engine").CreativePromptsOutput;
  image_gen?: import("@platform/ai-engine").ImageGenOutput;
  image_post?: import("@platform/ai-engine").ImagePostOutput;
  social_proof?: import("@platform/ai-engine").SocialProofOutput;
  upsell_match?: import("@platform/ai-engine").UpsellMatchOutput;
  assemble?: UniversalProduct;
}

/** Cost rows collected during a single stage. The orchestrator flushes
 *  them to the store at the end of each stage. */
export type StageCostBuffer = CostRow[];
