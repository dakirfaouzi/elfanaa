import { FileStore } from "@platform/ingest";
import path from "node:path";
import { validateIntake } from "./intake-validator";
import { platformDataRoot } from "./paths";
import { runIntakePipeline } from "./pipeline-runner";

/**
 * Intake dispatch — the server-side entry point that turns a validated
 * form into a running pipeline.
 *
 * # Background execution
 *
 * The pipeline is invoked WITHOUT awaiting. The dispatch function
 * returns the runId synchronously so the route can respond 202 and
 * the UI can navigate to `/runs/<id>` immediately. The pipeline's
 * progress is observed via the SSE endpoint, which tails the
 * RunRecord file the orchestrator writes.
 *
 * # Initial RunRecord
 *
 * We deliberately CREATE the RunRecord here, BEFORE handing off to
 * the pipeline runner. This guarantees the SSE watcher finds the
 * file even if the runner takes a few hundred ms to spin up the
 * provider chain. Without this seed, the watcher would hit
 * `not_found` for the first second or two and the UI would flash
 * an empty timeline.
 *
 * # Why the background promise's rejection is caught silently
 *
 * Any failure inside the pipeline writes a `failed` RunRecord; the
 * SSE watcher surfaces it to the operator. An unhandled rejection
 * here would crash the Next.js dev server's worker, so we attach a
 * `.catch()` that records the error to the RunRecord as a last-resort
 * safety net.
 */
export type DispatchActionResult =
  | { status: "ok"; runId: string }
  | { status: "invalid"; issues: Array<{ path: string; message: string }> };

export interface DispatchActionOptions {
  /** Override runtime config — tests pass a temp dataRoot. */
  dataRoot?: string;
}

export async function dispatchIntake(
  rawForm: unknown,
  opts: DispatchActionOptions = {},
): Promise<DispatchActionResult> {
  const validation = validateIntake(rawForm);
  if (validation.status !== "ok") {
    return { status: "invalid", issues: validation.issues };
  }

  const dataRoot = opts.dataRoot ?? platformDataRoot();

  // Seed the RunRecord file so the SSE watcher can find it
  // immediately. Status = pending; the orchestrator will flip it to
  // `running` on its first store interaction.
  const store = new FileStore(path.join(dataRoot, "runs"));
  await store.createRun({
    runId: validation.job.runId,
    job: validation.job,
    createdAt: validation.job.createdAt,
  });

  // Background — DO NOT await. The route returns synchronously.
  // The pipeline runner's own try/catch writes failures to the
  // RunRecord; this .catch is a safety net for unexpected throws
  // outside that handler.
  void runIntakePipeline({ job: validation.job, dataRoot }).catch(
    async (err) => {
      const message =
        err instanceof Error ? err.message : "intake_dispatch_unhandled_error";
      try {
        await store.markRunFailed(validation.job.runId, `dispatch_error:${message}`);
      } catch {
        // best-effort
      }
    },
  );

  return { status: "ok", runId: validation.job.runId };
}
