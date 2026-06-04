import type { RunStatus } from "@platform/ingest";
import { StatusIcon, type StatusGlyphKind } from "./StatusIcon";

/**
 * Coloured status pill — single source of truth for "what colour is
 * this state?" so it stays consistent across products / runs / steps.
 *
 * # Why a closed mapping
 *
 * Hardcoded mappings catch typos at compile time when the M6 status
 * union expands (cancelled → cancelled_by_user etc.). Open-ended
 * `Record<string, …>` wouldn't.
 *
 * Each tone is now paired with a `StatusIcon` glyph (Sprint 1) so status
 * is no longer colour-only — the glyph inherits the tone colour via
 * `currentColor`, reusing the existing `.tag-*` tokens.
 */
const RUN_STATUS_TONE: Record<RunStatus, "info" | "warning" | "success" | "danger"> = {
  pending: "info",
  running: "warning",
  completed: "success",
  failed: "danger",
  cancelled: "warning",
};

const RUN_STATUS_GLYPH: Record<RunStatus, StatusGlyphKind> = {
  pending: "pending",
  running: "running",
  completed: "completed",
  failed: "error",
  cancelled: "warning",
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const tone = RUN_STATUS_TONE[status];
  return (
    <span className={`tag tag-${tone}`}>
      <StatusIcon kind={RUN_STATUS_GLYPH[status]} />
      {status}
    </span>
  );
}

export function StepStatusBadge({
  status,
}: {
  status: "success" | "failed" | "skipped";
}) {
  const tone =
    status === "success" ? "success" : status === "failed" ? "danger" : "info";
  const glyph: StatusGlyphKind =
    status === "success" ? "completed" : status === "failed" ? "error" : "skipped";
  return (
    <span className={`tag tag-${tone}`}>
      <StatusIcon kind={glyph} />
      {status}
    </span>
  );
}

export function PublishedBadge() {
  return (
    <span className="tag tag-success">
      <StatusIcon kind="published" />
      Published
    </span>
  );
}

export function DraftBadge() {
  return (
    <span className="tag tag-info">
      <StatusIcon kind="draft" />
      Draft
    </span>
  );
}

export function CorruptedBadge() {
  return (
    <span className="tag tag-danger">
      <StatusIcon kind="error" />
      Corrupted
    </span>
  );
}
