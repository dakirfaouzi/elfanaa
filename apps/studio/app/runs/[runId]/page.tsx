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
import { readRun } from "@/lib/studio/run-loader";
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

  return (
    <div className="shell">
      <NavBar active="runs" />
      <main className="shell-main">
        <RunHeader run={run} />
        <CostSummary run={run} />
        {TERMINAL_STATUSES.has(run.status) ? (
          <StepTimeline steps={run.steps} />
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

function RunHeader({ run }: { run: RunRecord }) {
  return (
    <header
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Link href="/runs" style={{ color: "var(--text-faint)", fontSize: 12 }}>
          ← Runs
        </Link>
        <RunStatusBadge status={run.status} />
        <span className="tag tag-accent">{run.storeId}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h1 style={{ margin: 0, fontFamily: "ui-serif, Georgia, serif", fontSize: 24 }}>
            {run.runId}
          </h1>
          <span className="text-dim" style={{ fontSize: 13, wordBreak: "break-all" }}>
            {run.job.supplierUrl}
          </span>
        </div>
        {run.finalProduct && (
          <Link
            href={`/products/${encodeURIComponent(run.storeId)}/${encodeURIComponent(run.finalProduct.id)}`}
            className="btn btn-accent"
          >
            View product
          </Link>
        )}
      </div>
      {run.errorMessage && (
        <div
          style={{
            background: "var(--danger-soft)",
            border: "1px solid var(--danger)",
            borderRadius: 10,
            padding: 12,
            fontSize: 13,
          }}
        >
          <strong>Run failed:</strong> {run.errorMessage}
        </div>
      )}
    </header>
  );
}

function CostSummary({ run }: { run: RunRecord }) {
  return (
    <section className="section-card">
      <span className="section-eyebrow">Overview</span>
      <dl className="kv-grid">
        <dt>Total cost</dt>
        <dd>${run.totalCostUsd.toFixed(4)}</dd>
        <dt>Steps</dt>
        <dd>{run.steps.length}</dd>
        <dt>Created</dt>
        <dd>
          <code className="code">{run.createdAt}</code>
        </dd>
        {run.startedAt && (
          <>
            <dt>Started</dt>
            <dd>
              <code className="code">{run.startedAt}</code>
            </dd>
          </>
        )}
        {run.finishedAt && (
          <>
            <dt>Finished</dt>
            <dd>
              <code className="code">{run.finishedAt}</code>
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}

function StepTimeline({ steps }: { steps: StepRecord[] }) {
  return (
    <section className="section-card">
      <span className="section-eyebrow">Pipeline</span>
      <h2>Step timeline ({steps.length})</h2>
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((s, i) => (
          <StepRow key={`${s.stage}-${i}`} step={s} />
        ))}
      </ol>
    </section>
  );
}

function StepRow({ step }: { step: StepRecord }) {
  return (
    <li
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
        <StepStatusBadge status={step.status} />
        <strong>{step.stage}</strong>
        <span className="text-faint" style={{ fontSize: 12 }}>
          {step.durationMs}ms · attempts {step.attempts} · ${step.costUsd.toFixed(4)}
        </span>
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
    ? "Every stage completed successfully. Replay would re-run the entire pipeline."
    : "Replay resumes from the first non-successful stage.";

  return (
    <section className="section-card">
      <span className="section-eyebrow">Operator action</span>
      <h2>Replay</h2>
      <p className="text-dim" style={{ margin: 0, fontSize: 14 }}>
        {description} Provider env vars (<code className="code">ANTHROPIC_API_KEY</code>,{" "}
        <code className="code">FAL_KEY</code>, etc.) must be set on the Studio container.
      </p>
      <ReplayRunButton runId={run.runId} />
    </section>
  );
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
