/**
 * @platform/worker — package root.
 *
 * M6 surface = worker runtime + provider wiring + deterministic replay.
 *
 * Preferred import surfaces for callers:
 *
 *   import { runPipeline } from "@platform/worker/runtime";
 *   import { resolveProvidersForStore } from "@platform/worker/provider-wiring";
 *   import { replayRun } from "@platform/worker/replay";
 *
 * The root barrel re-exports the most-used items so quick scripts can
 * import everything from "@platform/worker" without subpaths.
 */
export {
  runPipeline,
  PIPELINE_STAGES,
  emptyCatalog,
  fixedCatalog,
  createLogger,
  consoleSink,
  noopSink,
  BufferSink,
  type Logger,
  type LogEvent,
  type LogSink,
  type LogLevel,
  type LogContext,
  type OrchestratorOptions,
  type OrchestratorResult,
  type PipelineStageName,
  type StageOutputs,
  type ResumePolicy,
} from "./runtime";

export {
  CostCeilingExceededError,
  type StepRecordedContext,
} from "./runtime/types";

export {
  withCostCeiling,
  type WithCostCeilingOptions,
} from "./middleware";

export {
  resolveProvidersForStore,
  wrapTextWithCost,
  wrapVisionWithCost,
  wrapImageWithCost,
  wrapScraperWithCost,
  wrapEmbeddingWithCost,
  type ResolvedProviders,
  type CostRecorderOptions,
} from "./provider-wiring";

export { replayRun, type ReplayOptions } from "./replay";
