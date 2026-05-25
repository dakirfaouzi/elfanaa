"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StepStatusBadge, RunStatusBadge } from "./StatusBadge";
import { RunProgress } from "./RunProgress";
import {
  STAGE_LABELS,
  type PipelineStage,
} from "@/lib/studio/pipeline-stages";
import { studioPath } from "@/lib/base-path";
import type { RunRecord, RunStatus, StepRecord } from "@platform/ingest";

/**
 * Live step timeline (PLATFORM.md M9 deliverable 2, "SSE progress streaming").
 *
 * Subscribes to `/api/studio/runs/<runId>/stream`, an EventSource of
 * RunWatcherEvents, and renders the unfolding step list in real time.
 *
 * # Initial state
 *
 * Hydrated from the server-rendered RunRecord (passed via `initialRun`).
 * The component then subscribes via EventSource and patches its local
 * copy as `step` events arrive. Once a `terminal` event lands the
 * subscription closes — terminal RunRecords are static.
 *
 * # Why not re-render the whole run from each snapshot?
 *
 * Each `step` event carries the LATEST run snapshot, but we deliberately
 * keep the timeline append-only here so step-finish flashes (CSS) and
 * scroll position remain stable. The status pill at the top reflects
 * `lastStatus`, which is always synced to the latest snapshot.
 *
 * # Reconnection
 *
 * `EventSource` retries automatically using the server's `retry:` value
 * (we don't set one, so the browser's default ~3000ms applies). Our
 * server-side watcher is idempotent — duplicate steps are deduped by
 * comparing `seq` against `lastSeq`.
 *
 * # Terminal → router.refresh (C1)
 *
 * When the SSE channel emits `terminal`, we close the EventSource AND
 * trigger `router.refresh()`. The server-rendered header re-runs and
 * picks up the persisted `draftId` from `readRun`, which lets the
 * "Open draft" bridge appear without the operator needing to F5. The
 * refresh is cheap (no full reload, no remount of this client tree)
 * and idempotent on a terminal run.
 *
 * # Polling fallback (C1.1 stabilisation)
 *
 * Production observation: an SSE channel that wedges after the initial
 * snapshot (proxy idle-timeout, transient 401 on JWT-cookie refresh,
 * intermediary buffering — many root causes share this failure mode)
 * leaves the page frozen at "Waiting for first stage…" even though the
 * pipeline finished successfully in Postgres. The browser does retry
 * `EventSource`, but the reconnect can silently fail in ways that
 * keep firing `error` instead of converging.
 *
 * To make the page eventually-consistent regardless of SSE liveness,
 * a parallel polling effect fetches `/api/studio/runs/<runId>` every
 * `POLL_INTERVAL_MS`. SSE remains the fast path (sub-second updates).
 * Polling is the safety net — if SSE works, polling re-states the same
 * data and React bails out; if SSE wedges, polling drives the page to
 * the correct terminal state within one poll cycle.
 *
 * Both paths converge through the shared `refreshedRef` guard, so
 * `router.refresh()` fires exactly once on terminal regardless of
 * which path observed it first.
 */

const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set([
  "completed",
  "failed",
  "cancelled",
]);

/** How often the fallback polls `/api/studio/runs/<runId>` when SSE
 *  may have wedged. 5s is conservative enough to be polite to the
 *  database (one indexed `findByRunId` per poll) and fast enough
 *  that a stuck page self-heals well inside the operator's
 *  attention span. */
const POLL_INTERVAL_MS = 5_000;
export function LiveStepTimeline(props: {
  runId: string;
  initialRun: RunRecord;
  /** Disable subscription when the run is already terminal — saves
   *  an HTTP roundtrip on permalinked completed runs. */
  terminal: boolean;
}) {
  const router = useRouter();
  const [steps, setSteps] = useState<StepRecord[]>(props.initialRun.steps);
  const [status, setStatus] = useState<RunStatus>(props.initialRun.status);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    props.initialRun.errorMessage,
  );
  const [totalCostUsd, setTotalCostUsd] = useState<number>(
    props.initialRun.totalCostUsd,
  );
  const [streamError, setStreamError] = useState<string | null>(null);
  const lastSeqRef = useRef<number>(-1);
  // Guard against running `router.refresh()` more than once per
  // mount — `terminal` events should be one-shot but a wedged SSE
  // server (or a manual replay POST mid-stream) could fire two.
  const refreshedRef = useRef(false);

  useEffect(() => {
    if (props.terminal) return;
    const url = studioPath(
      `/api/studio/runs/${encodeURIComponent(props.runId)}/stream`,
    );
    const src = new EventSource(url, { withCredentials: true });

    // Any successful payload from the server means the SSE channel is
    // healthy — clear a stale "disconnected" banner that was set by
    // an earlier `error` event during a reconnect storm.
    const clearStaleError = () => setStreamError(null);

    const onStep = (e: MessageEvent<string>) => {
      const ev = safeParse(e.data);
      if (!ev) return;
      if (typeof ev.seq === "number") {
        if (ev.seq <= lastSeqRef.current) return;
        lastSeqRef.current = ev.seq;
      }
      clearStaleError();
      if (ev.step) {
        setSteps((prev) => [...prev, ev.step as StepRecord]);
      }
      if (ev.run) {
        setTotalCostUsd((ev.run as RunRecord).totalCostUsd);
      }
      if (ev.status) setStatus(ev.status as RunStatus);
    };

    const onSnapshot = (e: MessageEvent<string>) => {
      const ev = safeParse(e.data);
      if (!ev) return;
      clearStaleError();
      if (ev.run) {
        setSteps((ev.run as RunRecord).steps ?? []);
        setStatus((ev.run as RunRecord).status);
        setTotalCostUsd((ev.run as RunRecord).totalCostUsd);
      }
    };

    const onTerminal = (e: MessageEvent<string>) => {
      const ev = safeParse(e.data);
      if (ev?.run) {
        const run = ev.run as RunRecord;
        setSteps(run.steps);
        setStatus(run.status);
        setTotalCostUsd(run.totalCostUsd);
        setErrorMessage(run.errorMessage);
      }
      src.close();
      // Surface the new draftId / finalProduct in the server-rendered
      // header without a hard reload. Guarded so a duplicate terminal
      // event doesn't double-refresh (and so the polling fallback's
      // terminal observation doesn't refresh again).
      if (!refreshedRef.current) {
        refreshedRef.current = true;
        router.refresh();
      }
    };

    src.addEventListener("snapshot", onSnapshot as EventListener);
    src.addEventListener("step", onStep as EventListener);
    src.addEventListener("status", onStep as EventListener);
    src.addEventListener("terminal", onTerminal as EventListener);
    src.addEventListener("corrupted", () => {
      setStreamError("run record is corrupted on disk");
      src.close();
    });
    src.addEventListener("not_found", () => {
      setStreamError("run not found");
      src.close();
    });
    src.addEventListener("error", () => {
      // The polling fallback (below) covers convergence — surface a
      // soft note rather than the alarming "stream disconnected"
      // text. Cleared the moment any fresh SSE payload lands via
      // `clearStaleError`.
      setStreamError("live updates paused — checking for changes every 5s");
    });

    return () => {
      src.close();
    };
  }, [props.runId, props.terminal, router]);

  /* ── Polling fallback ──────────────────────────────────────────────
     Runs in parallel with SSE. Fetches the run snapshot every 5s and
     drives the same state setters / refresh path the SSE handlers do.
     When the run is healthy and SSE is delivering, this is redundant
     but harmless (React bails out on equal state). When SSE is wedged,
     this is the path that gets the page to its terminal state.

     The effect mounts once on a live run and tears down either when
     the parent passes `terminal: true` (already-completed permalink)
     or when the component unmounts. Once the polled snapshot reports
     a terminal status, the interval is cleared and `router.refresh()`
     is fired (guarded by `refreshedRef`).
  */
  useEffect(() => {
    if (props.terminal) return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function pollOnce() {
      if (cancelled) return;
      try {
        const res = await fetch(
          studioPath(`/api/studio/runs/${encodeURIComponent(props.runId)}`),
          {
            credentials: "same-origin",
            // Always read the freshest server snapshot — never serve
            // from the bfcache / disk cache. Studio routes are also
            // `force-dynamic` so this is belt-and-braces.
            cache: "no-store",
          },
        );
        if (cancelled || !res.ok) return;

        const body = (await res.json()) as { run?: RunRecord };
        const run = body.run;
        if (cancelled || !run) return;

        // Replace local state with the authoritative server snapshot.
        // `setSteps` is REPLACED (not appended) — the server is the
        // source of truth, and an SSE-missed step would otherwise
        // never land in the timeline.
        setSteps(run.steps);
        setStatus(run.status);
        setTotalCostUsd(run.totalCostUsd);
        if (run.errorMessage) setErrorMessage(run.errorMessage);

        if (TERMINAL_STATUSES.has(run.status)) {
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
          if (!refreshedRef.current) {
            refreshedRef.current = true;
            router.refresh();
          }
        }
      } catch {
        // Network blip — swallow and let the next interval try again.
        // We deliberately don't surface a polling-side error to the
        // operator; if BOTH SSE and polling are failing, the SSE
        // `error` listener has already set `streamError`.
      }
    }

    // Kick off an immediate poll so a long-since-disconnected operator
    // recovers within ms of mount instead of waiting a full interval.
    void pollOnce();
    interval = setInterval(pollOnce, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [props.runId, props.terminal, router]);

  return (
    <section className="section-card">
      <header style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="section-eyebrow">Live timeline</span>
          <RunStatusBadge status={status} />
        </div>
        <span
          className="text-faint"
          style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}
        >
          {steps.length} step{steps.length === 1 ? "" : "s"} · ${totalCostUsd.toFixed(4)}
        </span>
      </header>

      <RunProgress steps={steps} status={status} />

      {streamError && (
        <div
          className="text-faint"
          style={{
            fontSize: 11,
            letterSpacing: "0.02em",
            fontStyle: "italic",
          }}
        >
          {streamError}
        </div>
      )}

      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.length === 0 && (
          <li className="text-dim" style={{ fontSize: 13, fontStyle: "italic" }}>
            Waiting for the first stage to complete…
          </li>
        )}
        {steps.map((s, i) => (
          <LiveStepRow key={`${s.stage}-${i}-${s.finishedAt}`} step={s} />
        ))}
      </ol>

      {errorMessage && (
        <div
          style={{
            background: "var(--danger-soft)",
            border: "1px solid var(--danger)",
            borderRadius: 10,
            padding: 12,
            fontSize: 13,
          }}
        >
          <strong>Run failed:</strong> {errorMessage}
        </div>
      )}
    </section>
  );
}

function LiveStepRow({ step }: { step: StepRecord }) {
  const label = isKnownStage(step.stage)
    ? STAGE_LABELS[step.stage]
    : step.stage;
  return (
    <li
      style={{
        background: "var(--bg-elev)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        transition: "border-color var(--transition-fast) var(--ease-out)",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <StepStatusBadge status={step.status} />
        <strong style={{ fontSize: 13, letterSpacing: "-0.01em" }}>{label}</strong>
        <span
          className="text-faint"
          style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}
        >
          {step.durationMs}ms · attempts {step.attempts} · ${step.costUsd.toFixed(4)}
        </span>
        {label !== step.stage && (
          <code className="code" style={{ fontSize: 10, color: "var(--text-faint)" }}>
            {step.stage}
          </code>
        )}
      </div>
      {step.errorMessage && (
        <div style={{ fontSize: 12, color: "var(--danger)" }}>
          [{step.errorKind ?? "error"}] {step.errorMessage}
        </div>
      )}
    </li>
  );
}

function isKnownStage(stage: string): stage is PipelineStage {
  return stage in STAGE_LABELS;
}

function safeParse(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}
