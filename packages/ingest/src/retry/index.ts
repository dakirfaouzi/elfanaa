/**
 * @platform/ingest/retry — barrel.
 *
 * RetryPolicy table + PLATFORM.md §15 defaults. The orchestrator
 * consumes `resolvePolicy(table, kind, stage)` before every retryable
 * call.
 */
export type {
  RetryKind,
  RetryPolicy,
  RetryPolicyTable,
} from "./types";
export { backoffForAttempt, resolvePolicy } from "./types";
export { defaultRetryPolicy } from "./default";
