import { promises as fs } from "node:fs";
import path from "node:path";
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
  // Top-level guard: NEVER throw across the wire. The route handler
  // depends on us returning a discriminated ReplayActionResult so it
  // can emit JSON every time. Without this catch, a throw from
  // resolveRunStore / loadPriorRun / rehydrateRunFile would bubble
  // out of the route, Next.js would render its default HTML error
  // page, and the client's `res.json()` would fail with the
  // confusing "non-JSON response" message instead of showing the
  // actual cause to the operator.
  //
  // Also logs the error to stderr (visible in the Studio container
  // logs) so an operator without browser DevTools can correlate.
  // Each stage that was previously try/catch-wrapped keeps its
  // narrower handler so we still distinguish providers_unavailable
  // vs. replay_failed for accurate UX.
  try {
    return await runReplayActionInner(opts);
  } catch (err) {
    const cause = formatErrorChain(err);
    // eslint-disable-next-line no-console
    console.error(
      `[replay-action] unexpected throw for run ${opts.runId}: ${cause}`,
    );
    return {
      status: "replay_failed",
      runId: opts.runId,
      reason: `unexpected_error: ${cause}`,
    };
  }
}

async function runReplayActionInner(
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

  // Rehydrate the filesystem mirror from the DB record before handing
  // off to the worker.
  //
  // Why: `replayRun` (packages/worker/src/replay.ts) does its OWN
  // `opts.store.getRun(runId)` at the top, and FileStore's
  // `appendStep` / `markRunComplete` / etc. all go through
  // `requireRun()` which reads the JSON file. If the file is absent
  // (DB-only record, e.g. one that survived a volume wipe), the
  // worker throws `run_not_found` even though we just resolved the
  // record above. Seeding the file once here avoids passing a
  // db-aware getRun through the worker's RunStore interface — which
  // would force every worker consumer to learn about Postgres.
  //
  // Idempotent: skips if the file already exists. Atomic via
  // tmp+rename so a partial write never leaves a corrupted record on
  // disk for the run-loader to choke on. Failure (permission denied,
  // ENOSPC, …) is converted to a typed `replay_failed` result with
  // the underlying message instead of an uncaught throw.
  try {
    await rehydrateRunFile(opts.runId, prior);
  } catch (err) {
    return {
      status: "replay_failed",
      runId: opts.runId,
      reason: `rehydrate_failed: ${formatErrorChain(err)}`,
    };
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
      reason: formatErrorChain(err),
    };
  }
}

/**
 * Walk `err.cause` chains and produce a single-line summary.
 *
 * The orchestrator's `formatErrorCauseChain` (M11) decorates worker
 * errors with the underlying provider response, but only at the
 * `stage_failed` log line. Replay surfaces raw Error objects from
 * a wider set of code paths (fs writes, Prisma init, env validation),
 * not all of which have a `cause`. Walking the chain ourselves keeps
 * the UI message useful regardless of the throw site.
 *
 * Caps at 4 hops so a pathological circular cause can't hang the
 * response. Joins with " | cause: " to mirror the orchestrator's
 * log format for visual consistency.
 */
function formatErrorChain(err: unknown, maxDepth = 4): string {
  const parts: string[] = [];
  let cur: unknown = err;
  for (let i = 0; i < maxDepth && cur; i++) {
    if (cur instanceof Error) {
      parts.push(cur.message || cur.name || "Error");
      cur = (cur as Error & { cause?: unknown }).cause;
    } else {
      parts.push(String(cur));
      cur = undefined;
    }
  }
  return parts.join(" | cause: ");
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
  // Each lookup in the fallback chain is independently try/catch'd
  // so a throw from one store (e.g. corrupted JSON in the file
  // mirror, Prisma transient error) doesn't short-circuit the
  // chain. We log the failure so the operator can see WHY a
  // particular store was skipped, then move on.
  try {
    const fromStore = await store.getRun(runId);
    if (fromStore) return fromStore;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[replay-action] primary store getRun threw for ${runId}: ${formatErrorChain(err)} — falling through to DB`,
    );
  }
  try {
    const persistence = getStudioPersistence();
    const repo = persistence.repositories?.run;
    if (repo) {
      const fromDb = await repo.loadForReplay(runId);
      if (fromDb) return fromDb;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[replay-action] DB repository loadForReplay threw for ${runId}: ${formatErrorChain(err)}`,
    );
  }
  return null;
}

/**
 * Seed the file mirror for a DB-only run record.
 *
 * Idempotent: no-op when the file already exists. Atomic: writes to
 * `<file>.tmp` first then renames, so a crash mid-write never leaves
 * a half-serialised JSON for `run-loader.ts` to flag as corrupted.
 *
 * Bypasses `FileStore` deliberately — that class exposes per-event
 * mutators (`createRun`, `appendStep`, …) tailored for the worker's
 * incremental write pattern. There's no public "snapshot this whole
 * record" verb because, until M13's recovery path, nothing needed
 * one. Adding it would require an interface change across the
 * RunStore contract; doing the raw fs.writeFile here keeps the
 * recovery code path scoped to the app layer where it belongs.
 *
 * The serialised JSON shape must exactly match what `FileStore`
 * writes; we use `JSON.stringify(record, null, 2)` to match its
 * 2-space-indent formatting so a future operator diffing the two
 * sees zero whitespace noise.
 */
async function rehydrateRunFile(
  runId: string,
  record: RunRecord,
): Promise<void> {
  const filePath = path.join(runsRoot(), `${runId}.json`);

  try {
    await fs.access(filePath);
    return; // already on disk — nothing to do
  } catch {
    // ENOENT — fall through and write.
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(record, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}
