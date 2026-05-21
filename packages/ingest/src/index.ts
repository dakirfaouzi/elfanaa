/**
 * @platform/ingest — package root.
 *
 * M6 surface = ingest contracts + queue/store/retry abstractions.
 * Future milestones extend behind the same interfaces:
 *
 *   • Inngest adapter (M6.5) implements `Queue<IngestJob>`.
 *   • PrismaStore (M10) implements `RunStore`.
 *
 * Preferred import surfaces for callers:
 *
 *   import { IngestJobSchema } from "@platform/ingest/jobs";
 *   import { MemoryQueue, FileQueue } from "@platform/ingest/queue";
 *   import { FileStore } from "@platform/ingest/store";
 *   import { defaultRetryPolicy } from "@platform/ingest/retry";
 *
 * This root-level barrel re-exports the most-used items so quick
 * scripts can import everything from "@platform/ingest" without
 * subpaths.
 */
export type { IngestJob, IngestImageRef } from "./jobs";
export { IngestJobSchema } from "./jobs";

export type {
  DequeueOptions,
  EnqueueResult,
  Queue,
  QueuedJob,
} from "./queue";
export { FileQueue, MemoryQueue } from "./queue";

export type {
  CostRow,
  ListRunsFilter,
  NewRunRecord,
  RunRecord,
  RunStatus,
  RunStore,
  StepRecord,
} from "./store";
export { FileStore, MemoryStore } from "./store";

export type {
  RetryKind,
  RetryPolicy,
  RetryPolicyTable,
} from "./retry";
export {
  backoffForAttempt,
  defaultRetryPolicy,
  resolvePolicy,
} from "./retry";
