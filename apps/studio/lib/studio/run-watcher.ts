import { readRun, type RunLoadResult } from "./run-loader";
import type { RunRecord, RunStatus, StepRecord } from "@platform/ingest";

/**
 * Polling-based RunRecord watcher.
 *
 * # Why polling and not chokidar / fs.watch?
 *
 *   • The M9 worker writes to `.platform-data/runs/<runId>.json`
 *     atomically (temp → rename), so any external file-watcher would
 *     see WRITE+DELETE+RENAME bursts that need debouncing anyway.
 *   • The SSE endpoint runs inside a serverless Next.js route handler
 *     where the OS-level inotify subscription is fragile across
 *     container restarts and not available on every host.
 *   • Polling at 750ms is plenty for a 5-stage pipeline that takes
 *     30s+ end-to-end; the operator never sees a noticeable lag.
 *
 * # Emission semantics
 *
 *   • The watcher emits an event for EVERY new step the file gains
 *     since the last poll, in order.
 *   • When the RunRecord's `status` flips to a terminal state
 *     (`completed | failed | cancelled`) the watcher emits a final
 *     event and resolves.
 *   • If the file is corrupted on a poll, the watcher emits a single
 *     `corrupted` event and resolves — there's no useful continuation.
 *   • If the run is missing on poll #1, the watcher polls up to
 *     `awaitMs` for the file to appear (the dispatcher creates it
 *     asynchronously). After that it emits `not_found` and resolves.
 *
 * # Cancellation
 *
 * Callers pass an `AbortSignal`. On abort the loop exits without
 * emitting further events. The SSE route uses `request.signal` so
 * client disconnects terminate polling immediately.
 */
export interface RunWatcherEvent {
  type:
    | "snapshot"     // initial RunRecord on first read
    | "step"         // a new StepRecord appended since the last poll
    | "status"       // RunRecord.status changed (without a new step)
    | "terminal"     // run reached a final state (completed/failed/cancelled)
    | "not_found"    // file never appeared within awaitMs
    | "corrupted";   // file failed validation on read
  runId: string;
  /** Sequence number across the watcher lifetime — used as SSE event id. */
  seq: number;
  /** New step appended (only on `type === "step"`). */
  step?: StepRecord;
  /** Latest snapshot of the run when relevant. */
  run?: RunRecord;
  /** Latest status when relevant. */
  status?: RunStatus;
  /** Corruption reason (only on `type === "corrupted"`). */
  reason?: string;
}

export interface WatchRunOptions {
  runId: string;
  /** Polling interval (ms). Default 750. */
  pollMs?: number;
  /** Max time to wait for the file to first appear (ms). Default 5000. */
  awaitMs?: number;
  /** AbortSignal for cancelling the watcher. */
  signal?: AbortSignal;
  /** Override the loader. Tests inject a mock. */
  readFn?: (runId: string) => Promise<RunLoadResult>;
  /** Sleep override. Tests inject a fake timer. */
  sleepFn?: (ms: number) => Promise<void>;
}

const TERMINAL_STATUSES = new Set<RunStatus>([
  "completed",
  "failed",
  "cancelled",
]);

/**
 * Async generator yielding RunWatcherEvents until terminal / aborted.
 *
 * The SSE route consumes this via `for await` and writes each event
 * to the response stream after passing it through `encodeSseEvent`.
 */
export async function* watchRun(
  opts: WatchRunOptions,
): AsyncGenerator<RunWatcherEvent, void, void> {
  const pollMs = opts.pollMs ?? 750;
  const awaitMs = opts.awaitMs ?? 5000;
  const read = opts.readFn ?? readRun;
  const sleep =
    opts.sleepFn ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  let seq = 0;
  let lastStepCount = 0;
  let lastStatus: RunStatus | undefined;
  let openedAt = Date.now();
  let firstRead = true;

  while (!opts.signal?.aborted) {
    const result = await read(opts.runId);

    if (result.status === "not_found") {
      // Allow a grace window for the dispatcher to create the file.
      if (Date.now() - openedAt > awaitMs) {
        yield { type: "not_found", runId: opts.runId, seq: seq++ };
        return;
      }
      await sleep(pollMs);
      continue;
    }

    if (result.status === "corrupted") {
      yield {
        type: "corrupted",
        runId: opts.runId,
        seq: seq++,
        reason: result.reason,
      };
      return;
    }

    const run = result.run;

    // First successful read — emit a snapshot so the client has the
    // initial state without needing a separate fetch.
    if (firstRead) {
      yield {
        type: "snapshot",
        runId: opts.runId,
        seq: seq++,
        run,
        status: run.status,
      };
      lastStepCount = run.steps.length;
      lastStatus = run.status;
      firstRead = false;
    } else {
      // Diff: emit each new step in order.
      const newSteps = run.steps.slice(lastStepCount);
      for (const step of newSteps) {
        yield {
          type: "step",
          runId: opts.runId,
          seq: seq++,
          step,
          run,
          status: run.status,
        };
      }
      lastStepCount = run.steps.length;

      // Status changed without a new step (e.g. completed but no
      // new step record): emit a status event for completeness.
      if (run.status !== lastStatus) {
        yield {
          type: "status",
          runId: opts.runId,
          seq: seq++,
          run,
          status: run.status,
        };
        lastStatus = run.status;
      }
    }

    if (TERMINAL_STATUSES.has(run.status)) {
      yield {
        type: "terminal",
        runId: opts.runId,
        seq: seq++,
        run,
        status: run.status,
      };
      return;
    }

    await sleep(pollMs);
  }
}
