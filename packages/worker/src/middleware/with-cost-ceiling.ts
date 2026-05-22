import type { StoreConfig } from "@platform/stores";
import { CostCeilingExceededError } from "../runtime/types";
import type {
  OrchestratorOptions,
  StepRecordedContext,
} from "../runtime/types";

/**
 * Cost-ceiling middleware (PLATFORM.md §15 "Cost ceilings").
 *
 * Wraps the orchestrator so that after each stage completes the
 * cumulative run cost is compared against
 * `StoreConfig.costCeilingPerDraftUsd`. If the cap is crossed the
 * middleware throws a `CostCeilingExceededError`; the orchestrator
 * catches it, marks the run `failed` with a stable `cost_exceeded:`
 * marker, and exits the dispatch loop without invoking any further
 * providers.
 *
 * # Design
 *
 * The wrapper exposes a single side-effect-free option override —
 * `onStepRecorded`. The orchestrator owns calling the hook; the
 * middleware owns the predicate. This keeps the cost-ceiling concern
 * additive (no orchestrator changes needed besides the generic hook)
 * and trivially testable in isolation: drive the hook with synthetic
 * `StepRecordedContext` values and assert it throws at the right
 * threshold.
 *
 * # Why the threshold check is `>` not `>=`
 *
 * `>` lets a run that lands exactly on the budget complete instead of
 * aborting on the boundary stage. The boundary is a soft cap intended
 * to catch runaway pipelines, not a hard ledger.
 *
 * # Composition with an upstream hook
 *
 * Callers may already have an `onStepRecorded` they want to keep
 * (e.g. a UI event emitter). `withCostCeiling(opts)` accepts an
 * optional `inner` hook that is invoked AFTER the ceiling predicate
 * passes — so the ceiling shorts the pipeline FIRST and downstream
 * hooks never see post-cap events.
 */

export interface WithCostCeilingOptions {
  /** Source of the ceiling. The middleware uses
   *  `storeConfig.costCeilingPerDraftUsd` (USD). */
  storeConfig: StoreConfig;
  /** Optional override — useful for tests that need a tighter cap
   *  than `StoreConfig` provides. When set, takes precedence over
   *  `storeConfig.costCeilingPerDraftUsd`. */
  ceilingUsd?: number;
  /** Optional inner hook composed AFTER the ceiling check. */
  inner?: NonNullable<OrchestratorOptions["onStepRecorded"]>;
}

/**
 * Construct an `onStepRecorded` hook that enforces the cost ceiling.
 *
 * Usage:
 *
 *   const onStepRecorded = withCostCeiling({ storeConfig });
 *   await runPipeline({ ...opts, onStepRecorded });
 */
export function withCostCeiling(
  opts: WithCostCeilingOptions,
): NonNullable<OrchestratorOptions["onStepRecorded"]> {
  const ceiling =
    typeof opts.ceilingUsd === "number"
      ? opts.ceilingUsd
      : opts.storeConfig.costCeilingPerDraftUsd;

  if (!Number.isFinite(ceiling) || ceiling <= 0) {
    throw new Error(
      `withCostCeiling_invalid_ceiling:${ceiling} — must be a positive finite USD value`,
    );
  }

  return async function onStepRecorded(ctx: StepRecordedContext): Promise<void> {
    if (ctx.totalCostUsd > ceiling) {
      throw new CostCeilingExceededError({
        runId: ctx.runId,
        stage: ctx.stage,
        totalCostUsd: ctx.totalCostUsd,
        ceilingUsd: ceiling,
      });
    }
    if (opts.inner) {
      await opts.inner(ctx);
    }
  };
}
