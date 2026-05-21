import type { RetryPolicyTable } from "./types";

/**
 * Default retry policy table (PLATFORM.md §15).
 *
 *   | Kind          | Max attempts | Backoff              |
 *   |---------------|--------------|----------------------|
 *   | provider_call | 3            | 1s → 5s → 25s        |
 *   | sharp         | 2            | linear (1s)          |
 *   | octokit       | 5            | exponential, jittered |
 *   | assemble      | 1            | n/a                  |
 *
 * Stage-level overrides:
 *   • `assemble` — explicitly 1 attempt (no retry); a second run on
 *                  the same input produces the same output.
 *   • `image_gen` — already retries internally per prompt (M5), so the
 *                   stage-level retry budget is 1 (don't compound).
 */
export const defaultRetryPolicy: RetryPolicyTable = {
  defaults: {
    provider_call: {
      maxAttempts: 3,
      // 1s, 5s, 25s — PLATFORM.md §15.
      backoffMs: (attempt) => 1000 * Math.pow(5, attempt - 1),
    },
    sharp: {
      maxAttempts: 2,
      backoffMs: (attempt) => 1000 * attempt,
    },
    octokit: {
      maxAttempts: 5,
      backoffMs: (attempt) => 500 * Math.pow(2, attempt - 1),
      jitter: 0.3,
    },
    assemble: {
      maxAttempts: 1,
      backoffMs: () => 0,
    },
  },
  stagePolicies: {
    assemble: { maxAttempts: 1 },
    image_gen: { maxAttempts: 1 },
  },
};
