/**
 * Queue contract — the abstraction every job source plugs behind
 * (PLATFORM.md §15).
 *
 * # Why an interface and not a concrete client
 *
 * The M6 worker must run against:
 *   • An in-memory queue (unit tests).
 *   • A file-backed queue (local dev — survives process restarts,
 *     deterministic replay).
 *   • An Inngest adapter (future — once the Studio webhook lands).
 *   • A BullMQ adapter (future — if Redis becomes the canonical queue).
 *
 * Keeping the interface narrow means a future Inngest/BullMQ adapter is
 * < 100 LOC. Wide interfaces ("supportsDelayedJobs", "deadLetterRoute",
 * "priorities") are deferred until a real production driver forces the
 * issue.
 *
 * # Concurrency semantics
 *
 *   • `dequeue` MAY block until a job is available (the `timeoutMs`
 *     argument lets callers bound the wait). Returns null on timeout.
 *   • `dequeue` returned jobs are "checked out" — other workers in the
 *     same queue MUST NOT receive the same job until `markComplete` or
 *     `markFailed` is called. The in-memory + file impls in M6 are
 *     single-worker only; real concurrency lands with the
 *     Inngest/BullMQ adapters.
 *   • `markFailed` increments the job's attempt counter. The orchestrator
 *     decides whether to re-enqueue via the retry policy.
 */

/** Shape of a job AS RETURNED BY `dequeue()`. */
export interface QueuedJob<T> {
  /** Queue-assigned stable ID. Distinct from any business-level ID inside `T`. */
  id: string;
  /** The job payload (caller-typed). */
  job: T;
  /** ISO-8601 timestamp of when `enqueue` was called. */
  enqueuedAt: string;
  /** How many times this job has been dequeued so far. 1 on first dequeue. */
  attempts: number;
}

/** Result of `enqueue()`. */
export interface EnqueueResult {
  id: string;
}

export interface DequeueOptions {
  /**
   * Max time (ms) to block waiting for a job. Default 0 = non-blocking.
   * Real adapters (BullMQ) translate this to BLPOP with a timeout;
   * in-memory / file impls poll on a short interval.
   */
  timeoutMs?: number;
}

export interface Queue<T> {
  /** Append a job to the tail. Returns the queue-assigned ID. */
  enqueue(job: T): Promise<EnqueueResult>;
  /** Pop the head — or wait up to `timeoutMs`. Returns null on timeout. */
  dequeue(opts?: DequeueOptions): Promise<QueuedJob<T> | null>;
  /** Acknowledge successful processing. Removes the job from the inflight set. */
  markComplete(id: string): Promise<void>;
  /** Acknowledge failed processing. Increments the attempt counter; the
   *  orchestrator's retry policy decides whether to call `enqueue` again. */
  markFailed(id: string, errorMessage: string): Promise<void>;
  /** Count of pending (not-yet-dequeued) jobs. */
  size(): Promise<number>;
}
