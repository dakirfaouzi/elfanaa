import { notFound } from "next/navigation";
import Link from "next/link";
import { NavBar } from "@/app/_components/NavBar";
import {
  CorruptedBadge,
  RunStatusBadge,
  StepStatusBadge,
} from "@/app/_components/StatusBadge";
import { LiveStepTimeline } from "@/app/_components/LiveStepTimeline";
import { ReplayRunButton } from "@/app/_components/ReplayRunButton";
import { RunProgress } from "@/app/_components/RunProgress";
import { readRun } from "@/lib/studio/run-loader";
import {
  STAGE_LABELS,
  type PipelineStage,
} from "@/lib/studio/pipeline-stages";
import type { StepRecord, RunRecord, RunStatus } from "@platform/ingest";

const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set([
  "completed",
  "failed",
  "cancelled",
]);

export const dynamic = "force-dynamic";

/**
 * Run detail — timeline + cost + replay controls + (when finalProduct
 * exists) a deep link to the materialised product.
 *
 * # Replay control
 *
 * The page renders the `<ReplayRunButton>` client component, which
 * POSTs to `/api/studio/runs/[runId]/replay` and surfaces live UX
 * states (running / ok / providers_unavailable / replay_failed).
 * History note: M11 shipped this as an inline server-action form,
 * but Next.js server actions silently fail behind the storefront's
 * reverse proxy at `elfanaa.com/studio` (Origin/Host mismatch with
 * `serverActions.allowedOrigins`, no console error, no network
 * activity). The client-fetch approach in `ReplayRunButton.tsx`
 * avoids that whole class of problem.
 *
 * # Bridges (C1)
 *
 * Two CTAs appear in the header when the underlying data is ready:
 *   • "Open draft" — links to `/drafts/<draftId>` for the owning
 *     draft once it's known (DB-backed runs only — filesystem
 *     fallback runs read `draftId === undefined`).
 *   • "View product" — links to the materialised storefront page
 *     when the run completed and produced a UniversalProduct.
 *
 * Both are additive — runs that pre-date the draft-seeding flow,
 * or that haven't completed yet, simply render fewer buttons.
 *
 * # Failure rendering
 *
 *   • RunRecord corrupted → focused error panel.
 *   • RunRecord not found → notFound() → 404 chrome.
 *   • Stage failed        → step row shows the errorMessage inline.
 */
export default async function RunDetailPage(props: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await props.params;
  const result = await readRun(runId);
  if (result.status === "not_found") notFound();

  if (result.status === "corrupted") {
    return (
      <div className="shell">
        <NavBar active="runs" />
        <main className="shell-main">
          <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <CorruptedBadge />
            <h1 style={{ margin: 0, fontFamily: "ui-serif, Georgia, serif", fontSize: 22 }}>
              {runId}
            </h1>
          </header>
          <section className="section-card">
            <h2>Run record could not be loaded</h2>
            <p className="text-dim" style={{ margin: 0, fontSize: 14 }}>
              File: <code className="code">{result.filePath}</code>
            </p>
            <p className="text-dim" style={{ margin: 0, fontSize: 14 }}>
              Reason: <code className="code">{result.reason}</code>
            </p>
            {result.details && (
              <pre
                style={{
                  background: "var(--bg-elev)",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                  margin: 0,
                }}
              >
                {result.details}
              </pre>
            )}
          </section>
        </main>
      </div>
    );
  }

  const run = result.run;
  const isTerminal = TERMINAL_STATUSES.has(run.status);

  return (
    <div className="shell">
      <NavBar active="runs" />
      <main className="shell-main">
        <RunHeader run={run} draftId={result.draftId ?? null} />
        <RunOverview run={run} />
        {isTerminal ? (
          <StepTimeline run={run} />
        ) : (
          <LiveStepTimeline runId={run.runId} initialRun={run} terminal={false} />
        )}
        <CostsTable run={run} />
        <JobPanel run={run} />
        <ReplayPanel run={run} />
      </main>
    </div>
  );
}

/* ─── Page sections ────────────────────────────────────────────────── */

function RunHeader({ run, draftId }: { run: RunRecord; draftId: string | null }) {
  // "Open draft" surfaces as a PRIMARY CTA only once the run completed
  // successfully — opening a partial draft mid-run leaves the operator
  // staring at an empty canvas. We still render it for failed runs as
  // a SECONDARY ghost button so the operator can inspect what landed
  // in the draft before the failure (recovery aid). Running runs hide
  // the bridge entirely — premature affordance.
  const showDraftBridge =
    typeof draftId === "string" && draftId.length > 0 && run.status !== "running" && run.status !== "pending";
  const draftBridgeStyle: "primary" | "ghost" =
    run.status === "completed" ? "primary" : "ghost";

  return (
    <header
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--text) 4%, transparent)",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Link
          href="/runs"
          style={{
            color: "var(--text-faint)",
            fontSize: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            transition: "color var(--transition-fast) var(--ease-out)",
          }}
        >
          ← Runs
        </Link>
        <RunStatusBadge status={run.status} />
        <span className="tag tag-accent">{run.storeId}</span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: "1 1 320px" }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "ui-serif, Georgia, serif",
              fontSize: 26,
              letterSpacing: "-0.4px",
              lineHeight: 1.15,
              wordBreak: "break-all",
            }}
          >
            {run.runId}
          </h1>
          <a
            href={run.job.supplierUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-dim"
            style={{
              fontSize: 13,
              wordBreak: "break-all",
              textDecoration: "none",
              transition: "color var(--transition-fast) var(--ease-out)",
            }}
          >
            {run.job.supplierUrl} ↗
          </a>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {showDraftBridge && draftId !== null && (
            <Link
              href={`/drafts/${encodeURIComponent(draftId)}`}
              className={draftBridgeStyle === "primary" ? "btn btn-accent" : "btn"}
              style={{
                minHeight: 38,
                fontWeight: draftBridgeStyle === "primary" ? 700 : 600,
              }}
            >
              {draftBridgeStyle === "primary" ? "Open draft →" : "View partial draft"}
            </Link>
          )}
          {run.finalProduct && (
            <Link
              href={`/products/${encodeURIComponent(run.storeId)}/${encodeURIComponent(run.finalProduct.id)}`}
              className={showDraftBridge ? "btn" : "btn btn-accent"}
              style={{ minHeight: 38, fontWeight: 600 }}
            >
              View product
            </Link>
          )}
        </div>
      </div>
      {run.errorMessage && (
        <div
          style={{
            background: "var(--danger-soft)",
            border: "1px solid var(--danger)",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 13,
          }}
        >
          <strong>Run failed:</strong> {run.errorMessage}
        </div>
      )}
    </header>
  );
}

/**
 * KPI strip + timestamps. Replaces the M9 `<dl>` cost-summary with
 * three headline KPI cards (Total cost / Stages / Duration) above a
 * compact metadata strip (Created / Started / Finished). Same data
 * the old `CostSummary` rendered — just laid out for at-a-glance
 * operator scanning.
 */
function RunOverview({ run }: { run: RunRecord }) {
  const stagesLabel = `${run.steps.length} / 11`;
  const stagesState: KpiState =
    run.status === "failed"
      ? "danger"
      : run.status === "completed"
        ? "success"
        : run.status === "running" || run.status === "pending"
          ? "neutral"
          : "neutral";
  const duration = computeDurationLabel(run);

  return (
    <section className="section-card">
      <span className="section-eyebrow">Overview</span>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
        <KpiCard
          label="Total cost"
          value={`$${run.totalCostUsd.toFixed(4)}`}
          state="neutral"
          emphasis
        />
        <KpiCard
          label="Stages"
          value={stagesLabel}
          state={stagesState}
          hint={
            run.status === "running" || run.status === "pending"
              ? "In flight…"
              : undefined
          }
        />
        <KpiCard
          label="Duration"
          value={duration.value}
          state={duration.state}
          hint={duration.hint}
        />
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px 18px",
          fontSize: 12,
          color: "var(--text-dim)",
          marginTop: 4,
        }}
      >
        <MetaRow label="Created" value={run.createdAt} />
        {run.startedAt && <MetaRow label="Started" value={run.startedAt} />}
        {run.finishedAt && <MetaRow label="Finished" value={run.finishedAt} />}
      </div>
    </section>
  );
}

function StepTimeline({ run }: { run: RunRecord }) {
  return (
    <section className="section-card">
      <header style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="section-eyebrow">Pipeline</span>
          <RunStatusBadge status={run.status} />
        </div>
        <span className="text-faint" style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
          {run.steps.length} step{run.steps.length === 1 ? "" : "s"} · ${run.totalCostUsd.toFixed(4)}
        </span>
      </header>
      <RunProgress steps={run.steps} status={run.status} />
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {run.steps.map((s, i) => (
          <StepRow key={`${s.stage}-${i}`} step={s} />
        ))}
      </ol>
    </section>
  );
}

function StepRow({ step }: { step: StepRecord }) {
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
          style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", letterSpacing: 0 }}
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

function CostsTable({ run }: { run: RunRecord }) {
  if (run.costs.length === 0) return null;
  return (
    <section className="section-card">
      <span className="section-eyebrow">Provider calls</span>
      <h2>Costs ({run.costs.length})</h2>
      <div style={{ overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--bg-elev)" }}>
              <Th>Stage</Th>
              <Th>Capability</Th>
              <Th>Provider</Th>
              <Th>Model</Th>
              <Th>Cost</Th>
              <Th>Latency</Th>
            </tr>
          </thead>
          <tbody>
            {run.costs.map((c, i) => (
              <tr key={i}>
                <Td>{c.stage}</Td>
                <Td>{c.capability}</Td>
                <Td>{c.providerId}</Td>
                <Td>{c.model ?? "—"}</Td>
                <Td>${c.costUsd.toFixed(4)}</Td>
                <Td>{c.latencyMs}ms</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function JobPanel({ run }: { run: RunRecord }) {
  return (
    <section className="section-card">
      <span className="section-eyebrow">Intake</span>
      <h2>Ingest job</h2>
      <dl className="kv-grid">
        <dt>Supplier URL</dt>
        <dd>
          <a href={run.job.supplierUrl} target="_blank" rel="noopener noreferrer">
            {run.job.supplierUrl}
          </a>
        </dd>
        <dt>Uploaded images</dt>
        <dd>{run.job.uploadedImages?.length ?? 0}</dd>
        {run.job.priceHint && (
          <>
            <dt>Price hint</dt>
            <dd>
              {run.job.priceHint.amount / 100} {run.job.priceHint.currency}
            </dd>
          </>
        )}
        {run.job.operatorNotes && (
          <>
            <dt>Operator notes</dt>
            <dd style={{ whiteSpace: "pre-wrap" }}>{run.job.operatorNotes}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

/* ─── Replay control ───────────────────────────────────────────────── */

function ReplayPanel({ run }: { run: RunRecord }) {
  const allOk = run.steps.length > 0 && run.steps.every((s) => s.status === "success");
  const description = allOk
    ? "Every stage completed successfully. Replaying re-runs the entire pipeline."
    : "Replay resumes from the first non-successful stage.";

  return (
    <section className="section-card">
      <span className="section-eyebrow">Operator action</span>
      <h2>Replay</h2>
      <p className="text-dim" style={{ margin: 0, fontSize: 14 }}>
        {description}
      </p>
      <ReplayRunButton runId={run.runId} />
    </section>
  );
}

/* ─── KPI primitives (mirror Intake's CostBreakdownCard rhythm) ───── */

type KpiState = "neutral" | "success" | "warning" | "danger";

function KpiCard(props: {
  label: string;
  value: string;
  hint?: string;
  state: KpiState;
  /** When true: bigger numeric (headline KPI). */
  emphasis?: boolean;
}) {
  const palette = (() => {
    switch (props.state) {
      case "success":
        return {
          color: "var(--success)",
          border: "color-mix(in srgb, var(--success) 40%, var(--border))",
          tint: "color-mix(in srgb, var(--success) 8%, transparent)",
        };
      case "warning":
        return {
          color: "var(--warning)",
          border: "color-mix(in srgb, var(--warning) 40%, var(--border))",
          tint: "color-mix(in srgb, var(--warning) 8%, transparent)",
        };
      case "danger":
        return {
          color: "var(--danger)",
          border: "color-mix(in srgb, var(--danger) 40%, var(--border))",
          tint: "color-mix(in srgb, var(--danger) 8%, transparent)",
        };
      default:
        return {
          color: "var(--text)",
          border: "var(--border)",
          tint: "color-mix(in srgb, var(--surface-2) 50%, transparent)",
        };
    }
  })();
  const valueSize = props.emphasis ? 22 : 18;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "10px 12px",
        background: palette.tint,
        border: `1px solid ${palette.border}`,
        borderRadius: "var(--radius)",
        transition:
          "border-color var(--transition-medium) var(--ease-out), background var(--transition-medium) var(--ease-out)",
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-dim)",
          fontWeight: 600,
        }}
      >
        {props.label}
      </span>
      <span
        style={{
          fontSize: valueSize,
          fontWeight: 700,
          color: palette.color,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
          lineHeight: 1.1,
        }}
      >
        {props.value}
      </span>
      {props.hint && (
        <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{props.hint}</span>
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        gap: 6,
        alignItems: "baseline",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <code className="code" style={{ fontSize: 11 }}>
        {value}
      </code>
    </span>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function isKnownStage(stage: string): stage is PipelineStage {
  return stage in STAGE_LABELS;
}

/**
 * Render the run's wall-clock duration (start→finish) for the
 * Duration KPI card.
 *
 *   • No startedAt yet               → "—" (neutral).
 *   • startedAt but no finishedAt    → "Live" (neutral, blue hint).
 *   • Both present                   → "Xm Ys" (success/danger by status).
 *
 * We deliberately don't tick a live counter here — the page is
 * server-rendered, and the LiveStepTimeline owns the per-step
 * realtime channel. A static "Live" label avoids implying a
 * precision the SSR can't deliver.
 */
function computeDurationLabel(run: RunRecord): {
  value: string;
  state: KpiState;
  hint?: string;
} {
  if (!run.startedAt) {
    return { value: "—", state: "neutral" };
  }
  if (!run.finishedAt) {
    return { value: "Live", state: "neutral", hint: "Pipeline in flight" };
  }
  const startMs = Date.parse(run.startedAt);
  const endMs = Date.parse(run.finishedAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return { value: "—", state: "neutral" };
  }
  const totalSec = Math.round((endMs - startMs) / 1000);
  const value = formatDurationSec(totalSec);
  const state: KpiState =
    run.status === "failed" ? "danger" : run.status === "completed" ? "success" : "neutral";
  return { value, state };
}

function formatDurationSec(totalSec: number): string {
  if (totalSec < 60) return `${totalSec}s`;
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes < 60) return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin === 0 ? `${hours}h` : `${hours}h ${remMin}m`;
}

/* ─── tiny inline cell helpers (kept local; the runs/page.tsx versions
   are scoped to that file) ─────────────────────────────────────────── */

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "8px 12px",
        fontSize: 11,
        letterSpacing: 0.16,
        textTransform: "uppercase",
        color: "var(--text-faint)",
        fontWeight: 600,
        borderBottom: "1px solid var(--border)",
        textAlign: "left",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "8px 12px",
        borderBottom: "1px solid var(--border)",
        verticalAlign: "middle",
        fontSize: 12,
      }}
    >
      {children}
    </td>
  );
}
