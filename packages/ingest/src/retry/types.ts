/**
 * Retry policy contract (PLATFORM.md §15 "Retries").
 *
 * The orchestrator looks up a stage's policy in this map before each
 * attempt and calls `shouldRetry()` after a failure. Replaces ad-hoc
 * retry logic scattered through the worker.
 *
 * # Why per-kind keys instead of per-stage
 *
 * PLATFORM.md §15 categorises retries by KIND (provider call / Sharp /
 * Octokit / assemble) not by stage. A single stage can issue multiple
 * KINDS of calls (e.g. copy stage = provider call), so policies are
 * keyed by kind and looked up at the call site.
 *
 * Stage overrides (`stagePolicies`) let specific stages tighten or
 * loosen the kind default — e.g. assemble is always 1-attempt because
 * it's a pure function of its inputs.
 */

/**
 * Categories of retryable work, matching PLATFORM.md §15 retry table.
 *
 * `assemble` is its own kind because it MUST NOT retry — re-running
 * the same pure inputs produces the same output, so a second attempt
 * is wasted compute.
 */
export type RetryKind =
  | "provider_call"   // text / vision / image / scraper / embedding
  | "sharp"           // image post-processing (M6+ worker stage)
  | "octokit"         // git/Github PR writer (M7 publisher)
  | "assemble";       // deterministic — never retry

export interface RetryPolicy {
  maxAttempts: number;
  /** Returns the delay in ms before attempt `n+1`. `n` is 1-based. */
  backoffMs(attempt: number): number;
  /** Optional jitter as fraction of backoff (0..1). 0 = deterministic. */
  jitter?: number;
}

export interface RetryPolicyTable {
  /** Default policy for each kind. */
  defaults: Record<RetryKind, RetryPolicy>;
  /** Stage-specific overrides, keyed by M5 pipeline stage name. */
  stagePolicies?: Record<string, Partial<RetryPolicy>>;
}

/**
 * Compute the effective policy for a stage + kind. Resolves stage
 * overrides on top of the kind default.
 */
export function resolvePolicy(
  table: RetryPolicyTable,
  kind: RetryKind,
  stage?: string,
): RetryPolicy {
  const base = table.defaults[kind];
  if (!stage) return base;
  const override = table.stagePolicies?.[stage];
  if (!override) return base;
  return { ...base, ...override };
}

/**
 * Compute the actual delay before retry N, with optional jitter.
 * Returns 0 when `attempt >= policy.maxAttempts` (caller should stop).
 */
export function backoffForAttempt(
  policy: RetryPolicy,
  attempt: number,
  randomFn: () => number = Math.random,
): number {
  if (attempt >= policy.maxAttempts) return 0;
  const base = policy.backoffMs(attempt);
  if (!policy.jitter || policy.jitter <= 0) return base;
  const swing = base * policy.jitter;
  return Math.max(0, base + (randomFn() - 0.5) * 2 * swing);
}
