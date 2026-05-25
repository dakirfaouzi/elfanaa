"use client";

import { useMemo } from "react";
import {
  STAGE_ORDER,
  STAGE_LABELS,
  STAGE_DESCRIPTIONS,
  computePipelineProgress,
  type PipelineStage,
  type RunStatusForProgress,
  type StagePipStatus,
} from "@/lib/studio/pipeline-stages";

/**
 * Pipeline progress visualisation (C1 — run detail polish).
 *
 * Renders three layered surfaces:
 *
 *   1. A KPI line — "Stage 7 of 11 · Image generation" — driven by
 *      the run's current ordinal + the operator-facing label.
 *   2. A 11-segment pip ladder — one chip per pipeline stage,
 *      colour-coded by per-stage status (success / failed / active /
 *      pending / skipped). Active stage pulses softly on running
 *      runs; pulse stripped under `prefers-reduced-motion` via
 *      `globals.css`'s blanket override.
 *   3. A continuous progress bar that fills as `fraction` advances.
 *
 * # Why all three and not just the bar
 *
 * The bar communicates "where we are" but loses stage identity.
 * The pip ladder communicates per-stage status (e.g. "vision
 * skipped, copy failed") but is hard to read at a glance for
 * "how close are we to done". The KPI line bridges the two with
 * a literal "Stage X of Y". Together they answer:
 *
 *   • At a glance: how far have we come? → progress bar.
 *   • Which stage is running RIGHT NOW? → KPI line + pulsing pip.
 *   • Did anything fail / get skipped? → coloured pips.
 *
 * # Pure presentation
 *
 * No SSE subscription, no fetch, no router refresh. The parent
 * (LiveStepTimeline for in-flight runs, RunDetailPage for terminal
 * runs) owns the step list and passes it in. Re-renders cheaply on
 * every `step` event without coupling to the SSE machinery.
 */

interface RunProgressProps {
  /** Step records from the run. Only `stage` + `status` are read. */
  steps: ReadonlyArray<{
    stage: string;
    status: "success" | "failed" | "skipped";
  }>;
  /** Current run status — drives the "is the current stage live?"
   *  decision in the underlying `computePipelineProgress` helper. */
  status: RunStatusForProgress;
  /** Compact mode hides the description tooltip caret (used when
   *  embedded inside another card where space is tight). Defaults
   *  to false. */
  compact?: boolean;
}

export function RunProgress({ steps, status, compact = false }: RunProgressProps) {
  const progress = useMemo(
    () => computePipelineProgress(steps, status),
    [steps, status],
  );

  const percentageLabel = `${Math.round(progress.fraction * 100)}%`;
  const isTerminal = status === "completed" || status === "failed" || status === "cancelled";
  const stageLabel =
    progress.currentStage !== null ? STAGE_LABELS[progress.currentStage] : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* ── KPI line: Stage X of Y · Stage name ──────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--text-faint)",
              fontWeight: 700,
            }}
          >
            Pipeline progress
          </span>
          {progress.currentStage !== null ? (
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text)",
                letterSpacing: "-0.01em",
              }}
            >
              Stage {progress.currentOrdinal} of {progress.totalCount}
              <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>
                {" · "}
                {stageLabel}
              </span>
            </span>
          ) : (
            <span
              className="text-dim"
              style={{ fontSize: 13, fontStyle: "italic" }}
            >
              Awaiting first stage…
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color:
              progress.failureCount > 0
                ? "var(--danger)"
                : isTerminal && status === "completed"
                  ? "var(--success)"
                  : "var(--accent)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.01em",
          }}
        >
          {percentageLabel}
        </span>
      </div>

      {/* ── Continuous progress bar ────────────────────────────────── */}
      <ProgressBar fraction={progress.fraction} status={status} hasFailure={progress.failureCount > 0} />

      {/* ── 11-segment pip ladder ──────────────────────────────────── */}
      <div
        role="list"
        aria-label="Pipeline stages"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${STAGE_ORDER.length}, 1fr)`,
          gap: 4,
          marginTop: 2,
        }}
      >
        {STAGE_ORDER.map((stage) => (
          <StagePip
            key={stage}
            stage={stage}
            status={progress.perStage[stage]}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

function ProgressBar({
  fraction,
  status,
  hasFailure,
}: {
  fraction: number;
  status: RunStatusForProgress;
  hasFailure: boolean;
}) {
  // Fill colour follows the run's headline state:
  //   • completed (no failures)  → success green
  //   • running / pending        → accent gold
  //   • any failure encountered  → danger red (overrides accent so
  //     the operator's eye lands on the failed segment)
  //   • cancelled (no failure)   → muted text-dim
  const fillColor =
    hasFailure || status === "failed"
      ? "var(--danger)"
      : status === "completed"
        ? "var(--success)"
        : status === "cancelled"
          ? "var(--text-dim)"
          : "var(--accent)";

  // Clamp so a malformed fraction can't blow out the bar.
  const pct = Math.min(100, Math.max(0, fraction * 100));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      style={{
        position: "relative",
        height: 6,
        background: "var(--bg-elev)",
        borderRadius: 999,
        overflow: "hidden",
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: `${pct}%`,
          background: fillColor,
          borderRadius: 999,
          // Smooth fill animation on each progress tick. Reduced-
          // motion override in globals.css strips this for
          // accessibility.
          transition:
            "width var(--transition-medium) var(--ease-out), background var(--transition-medium) var(--ease-out)",
          boxShadow: `0 0 12px -2px color-mix(in srgb, ${fillColor} 50%, transparent)`,
        }}
      />
    </div>
  );
}

function StagePip({
  stage,
  status,
  compact,
}: {
  stage: PipelineStage;
  status: StagePipStatus;
  compact: boolean;
}) {
  const palette = pipPalette(status);
  return (
    <div
      role="listitem"
      title={`${STAGE_LABELS[stage]} — ${STAGE_DESCRIPTIONS[stage]}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: compact ? "2px 0" : "4px 0",
      }}
    >
      <span
        style={{
          width: "100%",
          height: 6,
          borderRadius: 999,
          background: palette.fill,
          border: `1px solid ${palette.border}`,
          boxShadow:
            status === "active"
              ? "0 0 10px -1px color-mix(in srgb, var(--accent) 70%, transparent)"
              : "none",
          // Soft pulse on the active stage. Keyframes are inline via
          // `animation` on the CSS — we use a CSS-variable-driven
          // approach so prefers-reduced-motion (global) zeroes it.
          animation:
            status === "active"
              ? "intake-stage-pulse 1.4s var(--ease-out) infinite"
              : "none",
          transition:
            "background var(--transition-medium) var(--ease-out), border-color var(--transition-medium) var(--ease-out)",
        }}
      />
      {!compact && (
        <span
          style={{
            fontSize: 9,
            letterSpacing: "0.05em",
            textAlign: "center",
            color: palette.label,
            fontWeight: status === "active" || status === "failed" ? 700 : 500,
            lineHeight: 1.2,
            // Truncate long labels (e.g. "Image post-processing") so
            // the 11-column grid stays even.
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            width: "100%",
          }}
        >
          {STAGE_LABELS[stage]}
        </span>
      )}
    </div>
  );
}

function pipPalette(status: StagePipStatus): {
  fill: string;
  border: string;
  label: string;
} {
  switch (status) {
    case "success":
      return {
        fill: "var(--success)",
        border: "color-mix(in srgb, var(--success) 60%, transparent)",
        label: "var(--text-dim)",
      };
    case "failed":
      return {
        fill: "var(--danger)",
        border: "color-mix(in srgb, var(--danger) 70%, transparent)",
        label: "var(--danger)",
      };
    case "skipped":
      return {
        fill: "var(--warning)",
        border: "color-mix(in srgb, var(--warning) 50%, transparent)",
        label: "var(--text-dim)",
      };
    case "active":
      return {
        fill: "var(--accent)",
        border: "var(--accent)",
        label: "var(--accent)",
      };
    case "pending":
    default:
      return {
        fill: "var(--bg-elev)",
        border: "var(--border)",
        label: "var(--text-faint)",
      };
  }
}
