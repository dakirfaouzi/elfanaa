import type { RunStatus } from "@platform/ingest";

/**
 * Coloured status pill — single source of truth for "what colour is
 * this state?" so it stays consistent across products / runs / steps.
 *
 * # Why a closed mapping
 *
 * Hardcoded mappings catch typos at compile time when the M6 status
 * union expands (cancelled → cancelled_by_user etc.). Open-ended
 * `Record<string, …>` wouldn't.
 */
const RUN_STATUS_TONE: Record<RunStatus, "info" | "warning" | "success" | "danger"> = {
  pending: "info",
  running: "warning",
  completed: "success",
  failed: "danger",
  cancelled: "warning",
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const tone = RUN_STATUS_TONE[status];
  return <span className={`tag tag-${tone}`}>{status}</span>;
}

export function StepStatusBadge({
  status,
}: {
  status: "success" | "failed" | "skipped";
}) {
  const tone =
    status === "success" ? "success" : status === "failed" ? "danger" : "info";
  return <span className={`tag tag-${tone}`}>{status}</span>;
}

export function PublishedBadge() {
  return <span className="tag tag-success">Published</span>;
}

export function DraftBadge() {
  return <span className="tag tag-info">Draft</span>;
}

export function CorruptedBadge() {
  return <span className="tag tag-danger">Corrupted</span>;
}
