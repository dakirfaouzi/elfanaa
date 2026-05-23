import { FileStore } from "@platform/ingest";
import type { RunRecord, RunStore } from "@platform/ingest/store";
import { fanaaStore } from "@platform/stores";
import {
  replayRun,
  resolveProvidersForStore,
  emptyCatalog,
  createLogger,
  noopSink,
  type ResolvedProviders,
} from "@platform/worker";
import { getStudioPersistence } from "./persistence";
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
 *   • Prior-run lookup is Postgres-first, filesystem-fallback (M13).
 *     The replay then uses the dual-write CompositeRunStore so the
 *     replayed steps land in both stores.
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
  // RunStore selection: prefer the dual-write CompositeRunStore from
  // the persistence factory so replayed steps land in BOTH the file
  // and Postgres. Fall back to a fresh FileStore in environments
  // where the factory throws (tests without env stubs, dev without
  // ADMIN_DATABASE_URL). The fallback path keeps the same data root
  // as the worker so the worker and replay never disagree.
  const store: RunStore = resolveRunStore();

  // Prior-run lookup: DB-first (covers runs that survived a volume
  // wipe / live on a freshly mounted container), filesystem-fallback
  // (covers historical pre-M13 runs that were never dual-written or
  // dev environments without Postgres).
  const prior = await loadPriorRun(opts.runId, store);
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

/**
 * Resolve the RunStore the replay writes through.
 *
 * Production: `getStudioPersistence().runStore` is the
 * `CompositeRunStore` (file + Postgres dual-write) when
 * `STUDIO_PERSISTENCE_MODE=dual` and `ADMIN_DATABASE_URL` is set.
 *
 * Fallback: a fresh `FileStore` rooted at `runsRoot()`. Used in
 * tests (env stubs absent) and dev (Postgres unavailable). The
 * fallback path matches the legacy M9 behaviour exactly so the
 * existing test suite passes without modification.
 *
 * Why a fresh FileStore on every call rather than caching: the
 * persistence factory's snapshot is module-level cached. Tests
 * point `PLATFORM_DATA_ROOT` at a fresh tmpdir per spec, but the
 * cached snapshot's FileStore root never refreshes. The fresh
 * `new FileStore(runsRoot())` here re-reads the env var on every
 * invocation, so it always reflects the current data-root setting.
 */
function resolveRunStore(): RunStore {
  try {
    const persistence = getStudioPersistence();
    // Only adopt the factory's store when it actually wraps a
    // Postgres mirror — otherwise we'd inherit the cached snapshot's
    // stale FileStore root. file-only mode → use a fresh FileStore.
    if (persistence.repositories?.run) {
      return persistence.runStore;
    }
  } catch {
    // Factory threw (env invalid, etc.) — fall through to FileStore.
  }
  return new FileStore(runsRoot());
}

/**
 * Resolve the prior run record before kicking off the replay.
 *
 * The store's `getRun()` reads from the primary (file). When the
 * file has been lost to a rebuild but the DB row survives, the
 * fallback to `StudioRunRepository.loadForReplay()` recovers the
 * run. This is the recovery path that motivated M13 — operators
 * shouldn't lose the ability to replay just because the platform
 * wiped a volume.
 */
async function loadPriorRun(
  runId: string,
  store: RunStore,
): Promise<RunRecord | null> {
  const fromStore = await store.getRun(runId);
  if (fromStore) return fromStore;
  try {
    const persistence = getStudioPersistence();
    const repo = persistence.repositories?.run;
    if (repo) {
      const fromDb = await repo.loadForReplay(runId);
      if (fromDb) return fromDb;
    }
  } catch {
    // Persistence factory threw — nothing more we can do; the
    // caller will get a not_found response.
  }
  return null;
}
