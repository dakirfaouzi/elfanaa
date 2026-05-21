import { FileStore } from "@platform/ingest";
import { fanaaStore } from "@platform/stores";
import {
  replayRun,
  resolveProvidersForStore,
  emptyCatalog,
  createLogger,
  noopSink,
  type ResolvedProviders,
} from "@platform/worker";
import { runsRoot } from "./paths";

/**
 * Server-side replay action — invokes the M6 worker's deterministic
 * replay against a stored RunRecord.
 *
 * # Contract
 *
 *   • Runs SYNCHRONOUSLY inside the request handler. M8 is a single-
 *     operator UI; no concurrent replays are expected. The background
 *     daemon for parallel replays lands in M9 (Inngest webhook).
 *   • NEVER throws across the wire. Every failure path maps to a typed
 *     `ReplayActionResult` discriminator so the route can map cleanly
 *     to HTTP status codes.
 *   • Touches NOTHING outside `.platform-data/runs/<runId>.json` —
 *     no DB, no storefront, no R2.
 *
 * # Provider-resolution failure
 *
 * `resolveProvidersForStore` throws when an API key is missing.
 * That's the dominant failure mode in dev (Studio runs but the
 * provider keys aren't set). We catch it and return a structured
 * `providers_unavailable` result with the underlying message so the
 * UI can render a "set these env vars" hint.
 */
export type ReplayActionResult =
  | {
      status: "ok";
      runId: string;
      replayedStages: string[];
      totalCostUsd: number;
      finalProductId?: string;
    }
  | {
      status: "providers_unavailable";
      runId: string;
      reason: string;
    }
  | {
      status: "not_found";
      runId: string;
    }
  | {
      status: "replay_failed";
      runId: string;
      reason: string;
    };

export interface ReplayActionOptions {
  runId: string;
  /** Optional explicit stage to replay from. M8 UI sends none — the
   *  default resumes from the first non-successful stage, matching the
   *  most common operator intent ("retry what failed"). */
  fromStage?: string;
}

export async function runReplayAction(
  opts: ReplayActionOptions,
): Promise<ReplayActionResult> {
  const store = new FileStore(runsRoot());

  const prior = await store.getRun(opts.runId);
  if (!prior) {
    return { status: "not_found", runId: opts.runId };
  }

  let providers: ResolvedProviders;
  try {
    providers = resolveProvidersForStore({ storeConfig: fanaaStore });
  } catch (err) {
    return {
      status: "providers_unavailable",
      runId: opts.runId,
      reason: (err as Error).message,
    };
  }

  const logger = createLogger({
    sink: noopSink,
    context: { runId: opts.runId, storeId: prior.storeId },
  });

  try {
    const result = await replayRun({
      runId: opts.runId,
      storeConfig: fanaaStore,
      providers,
      store,
      catalog: emptyCatalog,
      fromStage: opts.fromStage as never,
      logger,
    });

    const replayedStages = result.run.steps
      .filter(
        (s) =>
          s.status === "success" &&
          (!opts.fromStage || s.stage === opts.fromStage),
      )
      .map((s) => s.stage);

    return {
      status: "ok",
      runId: opts.runId,
      replayedStages,
      totalCostUsd: result.run.totalCostUsd,
      finalProductId: result.run.finalProduct?.id,
    };
  } catch (err) {
    return {
      status: "replay_failed",
      runId: opts.runId,
      reason: (err as Error).message,
    };
  }
}
