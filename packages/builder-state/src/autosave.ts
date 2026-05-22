/**
 * Autosave scheduler — debounce + coalesce.
 *
 * # Why a scheduler instead of a React hook
 *
 * The hook layer (in apps/studio) calls `scheduler.notify(version)`
 * whenever the reducer's `documentVersion` changes. The scheduler:
 *
 *   1. Debounces for `debounceMs` (default 800 ms).
 *   2. Coalesces multiple notifications inside the debounce
 *      window — only the LATEST version triggers a save.
 *   3. Skips the save if a save is already in flight; queues
 *      one more save after the in-flight save resolves.
 *
 * The save call itself is provided by the host (a fetch closure).
 * Errors are reported via `onError`; success via `onSaved`.
 *
 * # Lifecycle
 *
 *   const scheduler = createAutosaveScheduler({
 *     debounceMs: 800,
 *     save:      (doc) => fetch(...),
 *     onSaved:   (version) => dispatch({ type: "MARK_SAVED", ... }),
 *     onError:   (err)     => dispatch({ type: "MARK_SAVE_ERROR", ... }),
 *     onSaving:  ()        => dispatch({ type: "MARK_SAVING" }),
 *   });
 *
 *   scheduler.notify(state.documentVersion, state.document);
 *   scheduler.dispose();
 *
 * # No I/O coupling
 *
 * The scheduler does NOT know about fetch, timers (it accepts a
 * timer API), or React. Tests inject a fake timer; production
 * passes `setTimeout` / `clearTimeout`.
 */

import type { DraftDocument } from "@platform/builder-schema";

export interface TimerLike {
  setTimeout: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (handle: ReturnType<typeof setTimeout>) => void;
  now: () => number;
}

export interface AutosaveOptions {
  debounceMs?: number;
  save: (doc: DraftDocument, version: number) => Promise<void>;
  onSaving?: () => void;
  onSaved?: (version: number, savedAt: number) => void;
  onError?: (err: Error) => void;
  timer?: TimerLike;
}

export interface AutosaveScheduler {
  notify(version: number, doc: DraftDocument): void;
  /** Immediately flush any pending save. Resolves when in-flight + queued saves complete. */
  flush(): Promise<void>;
  dispose(): void;
  /** Read-only state for tests / UI. */
  state(): {
    pendingVersion: number | null;
    inFlightVersion: number | null;
  };
}

const defaultTimer: TimerLike = {
  setTimeout: (cb, ms) => setTimeout(cb, ms),
  clearTimeout: (h) => clearTimeout(h),
  now: () => Date.now(),
};

export function createAutosaveScheduler(
  opts: AutosaveOptions,
): AutosaveScheduler {
  const debounceMs = opts.debounceMs ?? 800;
  const timer = opts.timer ?? defaultTimer;

  let pendingDoc: DraftDocument | null = null;
  let pendingVersion: number | null = null;
  let inFlightVersion: number | null = null;
  let debounceHandle: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const flushPending = async (): Promise<void> => {
    if (disposed) return;
    if (pendingVersion === null || pendingDoc === null) return;
    if (inFlightVersion !== null) {
      return;
    }
    const ver = pendingVersion;
    const doc = pendingDoc;
    pendingVersion = null;
    pendingDoc = null;
    inFlightVersion = ver;
    opts.onSaving?.();
    try {
      await opts.save(doc, ver);
      if (!disposed) {
        opts.onSaved?.(ver, timer.now());
      }
    } catch (err) {
      if (!disposed) {
        opts.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      inFlightVersion = null;
      if (pendingVersion !== null) {
        await flushPending();
      }
    }
  };

  const scheduleFlush = (): void => {
    if (debounceHandle !== null) {
      timer.clearTimeout(debounceHandle);
    }
    debounceHandle = timer.setTimeout(() => {
      debounceHandle = null;
      void flushPending();
    }, debounceMs);
  };

  return {
    notify(version, doc) {
      if (disposed) return;
      pendingVersion = version;
      pendingDoc = doc;
      scheduleFlush();
    },
    async flush() {
      if (debounceHandle !== null) {
        timer.clearTimeout(debounceHandle);
        debounceHandle = null;
      }
      await flushPending();
    },
    dispose() {
      disposed = true;
      if (debounceHandle !== null) {
        timer.clearTimeout(debounceHandle);
        debounceHandle = null;
      }
      pendingDoc = null;
      pendingVersion = null;
    },
    state() {
      return { pendingVersion, inFlightVersion };
    },
  };
}
