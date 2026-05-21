/**
 * @platform/worker/runtime — barrel.
 *
 * Exports the orchestrator + supporting types + logger + catalog stub.
 * The orchestrator is the entry point: `runPipeline(opts)`.
 */
export { runPipeline } from "./orchestrator";
export type {
  OrchestratorOptions,
  OrchestratorResult,
  PipelineStageName,
  ResumePolicy,
  StageOutputs,
} from "./types";
export { PIPELINE_STAGES } from "./types";
export {
  BufferSink,
  consoleSink,
  createLogger,
  noopSink,
  type LogContext,
  type LogEvent,
  type LogLevel,
  type LogSink,
  type Logger,
} from "./logger";
export { emptyCatalog, fixedCatalog } from "./catalog-stub";
