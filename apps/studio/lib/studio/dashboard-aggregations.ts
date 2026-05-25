import type { DraftListItem } from "./drafts-service";
import type { ProductSummary } from "./product-loader";
import type { RunSummary } from "./run-loader";
import { bucketStatus } from "./draft-status-options";

/**
 * Pure aggregation helpers for the C4 operator dashboard.
 *
 * # Why pure helpers
 *
 * The dashboard page is a server component that fans out to the existing
 * loaders (`listRuns`, `listDrafts`, `listProducts`) and reduces the
 * results into the shapes the dashboard cards consume. Keeping the
 * reduction in pure functions means:
 *
 *   1. The dashboard page stays thin (just `await` + render).
 *   2. Every aggregator is unit-testable in isolation — no I/O, no
 *      `Date.now()` baked into the body, no Prisma fixtures.
 *   3. Future surfaces (e.g. an operator inbox, a public health page)
 *      can reuse the same reducers without re-implementing them.
 *
 * # Deterministic time
 *
 * Every helper that needs "now" accepts it as an explicit argument
 * (typically a `Date`) so tests can pin the wall clock and assert
 * deterministic bucket boundaries. Production callers pass
 * `new Date()` once at the top of the page render and thread it down
 * so every aggregator sees the same reference moment.
 *
 * # Zero schema work
 *
 * These helpers consume the EXISTING `DraftListItem`, `RunSummary`,
 * and `ProductSummary` shapes — no new fields, no new repository
 * methods, no migration. Tier-A scope per the C4 brief.
 */

// ─────────────────────────────────────────────────────────────────────────
// Run aggregations
// ─────────────────────────────────────────────────────────────────────────

export interface RunsSummary {
  /** Runs created in the rolling 24h window ending at `now`. The
   *  "today" framing is sloppy in calendar terms but operator-useful:
   *  "how much pipeline activity happened in the last day?" reads
   *  identically at 09:00 and 23:00. */
  totalToday: number;
  /** Subset of `totalToday` that finished with status="completed". */
  completedToday: number;
  /** Subset of `totalToday` that ended with status="failed" or
   *  surfaced as "corrupted". Corrupted runs ARE failures from the
   *  operator's perspective — the pipeline produced an unreadable
   *  artefact. */
  failedToday: number;
  /** Total runs currently mid-flight (`pending` or `running`),
   *  regardless of when they started. Snapshot across all time so
   *  long-running pipelines aren't hidden when they cross midnight. */
  runningNow: number;
}

/**
 * Summarise the operator's last-24h pipeline activity.
 *
 * `runningNow` deliberately ignores the 24h window so a long stage that
 * crossed the boundary still surfaces — the dashboard's job is to
 * tell the operator "what's live right now", not "what started inside
 * a clock window".
 */
export function summariseRuns(
  runs: ReadonlyArray<RunSummary>,
  now: Date = new Date(),
): RunsSummary {
  const windowStart = now.getTime() - 24 * 60 * 60 * 1000;
  let totalToday = 0;
  let completedToday = 0;
  let failedToday = 0;
  let runningNow = 0;

  for (const run of runs) {
    if (run.status === "pending" || run.status === "running") {
      runningNow += 1;
    }
    const createdMs = Date.parse(run.createdAt);
    if (!Number.isFinite(createdMs) || createdMs < windowStart) continue;
    totalToday += 1;
    // Corrupted runs ARE failures from the operator's perspective —
    // even when the status field says "completed", the artefact is
    // unreadable. We classify them as failures *exclusively* (not also
    // as completed) so `completedToday + failedToday <= totalToday`,
    // which the KPI chips quietly rely on for sensible totals.
    if (run.corrupted || run.status === "failed") {
      failedToday += 1;
    } else if (run.status === "completed") {
      completedToday += 1;
    }
  }
  return { totalToday, completedToday, failedToday, runningNow };
}

// ─────────────────────────────────────────────────────────────────────────
// Draft aggregations
// ─────────────────────────────────────────────────────────────────────────

export interface DraftsSummary {
  /** Drafts in any in-flight pipeline state (intake / generating /
   *  publishing). Operators read this as "things the AI is currently
   *  chewing on". */
  inProgress: number;
  /** Drafts in the operator-review state (status=ready). */
  ready: number;
  /** Drafts that hit a pipeline or publish error and need triage. */
  failed: number;
  /** Drafts the operator explicitly retired. Surfaced for completeness;
   *  the dashboard de-emphasises this count. */
  archived: number;
  /** Drafts that successfully published at least once. */
  published: number;
}

export function summariseDrafts(
  drafts: ReadonlyArray<DraftListItem>,
): DraftsSummary {
  const buckets: DraftsSummary = {
    inProgress: 0,
    ready: 0,
    failed: 0,
    archived: 0,
    published: 0,
  };
  for (const d of drafts) {
    switch (bucketStatus(d.status)) {
      case "in_progress":
        buckets.inProgress += 1;
        break;
      case "drafts":
        buckets.ready += 1;
        break;
      case "failed":
        buckets.failed += 1;
        break;
      case "archived":
        buckets.archived += 1;
        break;
      case "published":
        buckets.published += 1;
        break;
    }
  }
  return buckets;
}

/**
 * Drafts that NEED operator attention — surfaced on the dashboard's
 * "Drafts attention" card.
 *
 * Selection:
 *   • status=ready  → AI finished, awaiting operator review.
 *   • status=failed → pipeline / publish errored, needs triage.
 *
 * Sort: most-recently-updated first. The operator's mental model is
 * "what did I leave half-finished?" so freshness beats age.
 *
 * Limit: defaults to 10, configurable for future surfaces.
 */
export function pickAttentionDrafts(
  drafts: ReadonlyArray<DraftListItem>,
  take = 10,
): DraftListItem[] {
  return drafts
    .filter((d) => d.status === "ready" || d.status === "failed")
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, Math.max(0, take));
}

// ─────────────────────────────────────────────────────────────────────────
// Publish aggregations
// ─────────────────────────────────────────────────────────────────────────

export interface PublishesSummary {
  /** Every product in the catalog right now — across all stores. */
  totalLive: number;
  /** Subset of `totalLive` that published in the last 24h. */
  last24h: number;
}

export function summarisePublishes(
  products: ReadonlyArray<ProductSummary>,
  now: Date = new Date(),
): PublishesSummary {
  const windowStart = now.getTime() - 24 * 60 * 60 * 1000;
  let totalLive = 0;
  let last24h = 0;
  for (const p of products) {
    if (p.corrupted) continue;
    totalLive += 1;
    if (!p.publishedAt) continue;
    const publishedMs = Date.parse(p.publishedAt);
    if (!Number.isFinite(publishedMs)) continue;
    if (publishedMs >= windowStart) last24h += 1;
  }
  return { totalLive, last24h };
}

/**
 * The most-recently-published products — surfaced on the dashboard's
 * horizontal "Recent publishes" strip.
 *
 * Corrupted bundles are filtered out (the strip is a positive surface;
 * a broken product belongs on the products list with its corruption
 * badge, not on the dashboard's "look what just shipped" rail).
 */
export function pickRecentPublishes(
  products: ReadonlyArray<ProductSummary>,
  take = 5,
): ProductSummary[] {
  return products
    .filter((p) => !p.corrupted && Boolean(p.publishedAt))
    .slice()
    .sort((a, b) =>
      (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
    )
    .slice(0, Math.max(0, take));
}

// ─────────────────────────────────────────────────────────────────────────
// Recent runs (for the "Recent runs" card)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The most-recent pipeline executions, newest first. Corrupted run
 * records ARE included because the operator needs to know they exist
 * (the card renders them with a Corrupted badge instead of a normal
 * status pill).
 */
export function pickRecentRuns(
  runs: ReadonlyArray<RunSummary>,
  take = 10,
): RunSummary[] {
  return runs
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, Math.max(0, take));
}

// ─────────────────────────────────────────────────────────────────────────
// Pipeline health
// ─────────────────────────────────────────────────────────────────────────

export interface PipelineHealth {
  /** Fraction in [0, 1]. Multiply by 100 for the operator-facing % */
  successRate: number;
  /** Average wall-clock duration of completed runs in the sample, in
   *  milliseconds. `null` when no completed runs landed in the sample
   *  (e.g. brand-new deployment). */
  avgDurationMs: number | null;
  /** Number of runs that were actually counted for `successRate`. The
   *  card surfaces this so the operator knows whether a "100% success
   *  rate" was over 50 runs or over 3. */
  sampleSize: number;
}

/**
 * Compute a coarse health snapshot from the most-recent runs.
 *
 * # Sample shape
 *
 * The function takes the most-recent `take` runs (default 20), then:
 *
 *   • Counts terminal statuses ONLY — `pending` and `running` are
 *     excluded from the denominator. A run in flight is neither a
 *     success nor a failure yet, and folding it into either bucket
 *     would skew the rate.
 *   • Treats `corrupted` as a failure for rate purposes (mirrors the
 *     intent of `summariseRuns`).
 *   • Computes `avgDurationMs` only from runs with both `createdAt`
 *     and `finishedAt` parseable; ignores the rest.
 *
 * # Why not over ALL runs
 *
 * A long-running pipeline accumulates hundreds of legacy runs whose
 * provider snapshots have rotated. The operator's mental model is
 * "is the system healthy RIGHT NOW?", so we report on a rolling
 * recent window rather than a lifetime aggregate.
 */
export function pipelineHealth(
  runs: ReadonlyArray<RunSummary>,
  take = 20,
): PipelineHealth {
  const recent = runs
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, Math.max(0, take));

  let success = 0;
  let counted = 0;
  let durationSumMs = 0;
  let durationCount = 0;
  for (const r of recent) {
    if (r.status === "pending" || r.status === "running") continue;
    counted += 1;
    if (r.status === "completed" && !r.corrupted) {
      success += 1;
    }
    if (r.status === "completed" && r.finishedAt) {
      const startMs = Date.parse(r.createdAt);
      const endMs = Date.parse(r.finishedAt);
      if (
        Number.isFinite(startMs) &&
        Number.isFinite(endMs) &&
        endMs >= startMs
      ) {
        durationSumMs += endMs - startMs;
        durationCount += 1;
      }
    }
  }
  return {
    successRate: counted === 0 ? 0 : success / counted,
    avgDurationMs: durationCount === 0 ? null : durationSumMs / durationCount,
    sampleSize: counted,
  };
}

/**
 * Format a duration as a compact "Xm Ys" string for the health line.
 * 0s when the input is non-positive.
 *
 * # Why colocate the formatter
 *
 * Every consumer of `pipelineHealth.avgDurationMs` formats it the same
 * way. Putting the formatter next to the aggregator makes it impossible
 * for two surfaces to disagree on rounding / display rules.
 */
export function formatHealthDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

/**
 * Format a success rate fraction as "XX%" — rounded to the nearest
 * integer for readability. Returns "—" when the sample is empty so the
 * card doesn't lie ("100%" with sample=0 is misleading).
 */
export function formatHealthPercent(
  rate: number,
  sampleSize: number,
): string {
  if (sampleSize === 0) return "—";
  return `${Math.round(rate * 100)}%`;
}
