import type { RunStore } from "@platform/ingest";
import { runPipeline } from "./runtime/orchestrator";
import type {
  OrchestratorOptions,
  OrchestratorResult,
  PipelineStageName,
  ResumePolicy,
} from "./runtime/types";
import { PIPELINE_STAGES } from "./runtime/types";

/**
 * Deterministic pipeline replay (PLATFORM.md §15 "Replay").
 *
 * Replay a previously-run pipeline by reading its persisted
 * `RunRecord` and re-dispatching only the stages that were NOT
 * successful. Successful stages contribute their persisted output to
 * the in-memory `StageOutputs` bag and are skipped — re-running them
 * would call providers again unnecessarily and break cost attribution.
 *
 * # When to replay
 *
 *   • A stage failed mid-run (network blip, provider 5xx after policy
 *     exhausted) — replay continues from the failed stage onward.
 *   • A bug was fixed in a downstream stage (e.g. `social_proof`
 *     prompt) and you want to re-render only that part of an existing
 *     draft. Pass `fromStage: "social_proof"`.
 *   • A new image was uploaded — replay from `vision` onward.
 *
 * # Determinism caveat
 *
 * "Deterministic" here means STRUCTURAL determinism — the orchestrator
 * dispatches stages in the same order with the same inputs. The
 * provider responses themselves are NOT deterministic (LLM sampling,
 * fal.ai image gen with random seed). PLATFORM.md §15 calls this out:
 * "Replaying is free if the step is a pure function of its inputs
 * (true for all stages except image gen, which is intentionally
 * non-deterministic)."
 *
 * To get bit-for-bit reproducibility of image gen, the future
 * publisher must persist the per-image seed alongside its output;
 * a follow-up adapter passes the seed back through `creativePrompts`
 * on replay. M6 ships the structural replay; seed-pinning is M10.
 */
export interface ReplayOptions
  extends Omit<OrchestratorOptions, "resume" | "job"> {
  /** ID of the run to replay. The orchestrator loads it (and its
   *  embedded IngestJob) from the store. */
  runId: string;
  /** Optional: rerun from this stage onward. When omitted, replay
   *  continues from the FIRST stage that wasn't completed successfully. */
  fromStage?: PipelineStageName;
}

export async function replayRun(
  opts: ReplayOptions,
): Promise<OrchestratorResult> {
  const prior = await opts.store.getRun(opts.runId);
  if (!prior) {
    throw new Error(`replay_failed: run_not_found ${opts.runId}`);
  }

  // Determine where to resume from.
  // 1. Explicit `fromStage` wins.
  // 2. Otherwise: first stage WITHOUT a successful step record.
  const fromStage =
    opts.fromStage ??
    PIPELINE_STAGES.find((stage) => !hasSuccessfulStep(prior, stage));

  if (!fromStage) {
    // Every stage already succeeded → nothing to replay. Return the
    // existing run as-is.
    return {
      run: prior,
      product: prior.finalProduct,
    };
  }

  const resume: ResumePolicy = { prior, fromStage };
  // Rebuild the orchestrator options. `job`/`storeConfig`/`providers`
  // must be supplied by the caller — the persisted IngestJob is on
  // `prior.job`, but the providers + storeConfig are runtime concerns.
  return runPipeline({
    job: prior.job,
    storeConfig: opts.storeConfig,
    providers: opts.providers,
    store: opts.store,
    catalog: opts.catalog,
    retryPolicy: opts.retryPolicy,
    logger: opts.logger,
    resume,
  });
}

function hasSuccessfulStep(
  prior: ReturnType<RunStore["getRun"]> extends Promise<infer R>
    ? Exclude<R, null>
    : never,
  stage: PipelineStageName,
): boolean {
  return prior.steps.some(
    (s) => s.stage === stage && s.status === "success",
  );
}
