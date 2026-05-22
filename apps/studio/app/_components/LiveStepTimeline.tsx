"use client";

import { useEffect, useRef, useState } from "react";
import { StepStatusBadge, RunStatusBadge } from "./StatusBadge";
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
 */
export function LiveStepTimeline(props: {
  runId: string;
  initialRun: RunRecord;
  /** Disable subscription when the run is already terminal — saves
   *  an HTTP roundtrip on permalinked completed runs. */
  terminal: boolean;
}) {
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

  useEffect(() => {
    if (props.terminal) return;
    const url = `/api/studio/runs/${encodeURIComponent(props.runId)}/stream`;
    const src = new EventSource(url, { withCredentials: true });

    const onStep = (e: MessageEvent<string>) => {
      const ev = safeParse(e.data);
      if (!ev) return;
      if (typeof ev.seq === "number") {
        if (ev.seq <= lastSeqRef.current) return;
        lastSeqRef.current = ev.seq;
      }
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
      setStreamError("stream disconnected — browser will retry");
    });

    return () => {
      src.close();
    };
  }, [props.runId, props.terminal]);

  return (
    <section className="section-card">
      <header style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="section-eyebrow">Live timeline</span>
          <RunStatusBadge status={status} />
        </div>
        <span className="text-faint" style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
          {steps.length} step{steps.length === 1 ? "" : "s"} · ${totalCostUsd.toFixed(4)}
        </span>
      </header>

      {streamError && (
        <div style={{ fontSize: 12, color: "var(--warning)" }}>
          SSE: {streamError}
        </div>
      )}

      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.length === 0 && (
          <li className="text-dim" style={{ fontSize: 13 }}>
            Waiting for the first stage to complete…
          </li>
        )}
        {steps.map((s, i) => (
          <li
            key={`${s.stage}-${i}-${s.finishedAt}`}
            style={{
              background: "var(--bg-elev)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <StepStatusBadge status={s.status} />
              <strong>{s.stage}</strong>
              <span className="text-faint" style={{ fontSize: 12 }}>
                {s.durationMs}ms · attempts {s.attempts} · ${s.costUsd.toFixed(4)}
              </span>
            </div>
            {s.errorMessage && (
              <div style={{ fontSize: 12, color: "var(--danger)" }}>
                [{s.errorKind ?? "error"}] {s.errorMessage}
              </div>
            )}
          </li>
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

function safeParse(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}
