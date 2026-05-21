import Link from "next/link";
import { NavBar } from "../_components/NavBar";
import { EmptyState } from "../_components/EmptyState";
import {
  RunStatusBadge,
  CorruptedBadge,
} from "../_components/StatusBadge";
import { listRuns, type RunSummary } from "@/lib/studio/run-loader";

export const dynamic = "force-dynamic";

/**
 * Runs browser — lists every M6 worker RunRecord under
 * `.platform-data/runs/`.
 *
 * # What the operator sees
 *
 *   • A table of runs, newest first.
 *   • Status pills (running, completed, failed, …).
 *   • Quick links to the run detail page (step timeline + replay).
 *   • Empty state with hint pointing to the M6 dispatch CLI when no
 *     runs have happened yet.
 */
export default async function RunsPage() {
  const runs = await listRuns();
  return (
    <div className="shell">
      <NavBar active="runs" />
      <main className="shell-main">
        <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="section-eyebrow">M8 · Studio</span>
          <h1
            style={{
              margin: 0,
              fontFamily: "ui-serif, Georgia, serif",
              fontSize: "clamp(24px, 3vw, 32px)",
              letterSpacing: -0.4,
            }}
          >
            Runs
          </h1>
          <p className="text-dim" style={{ margin: 0, fontSize: 14 }}>
            Pipeline executions written by the M6 worker under{" "}
            <code className="code">.platform-data/runs/</code>
            {runs.length > 0 ? ` · ${runs.length} run${runs.length === 1 ? "" : "s"}` : ""}.
          </p>
        </header>

        {runs.length === 0 ? (
          <EmptyState
            title="No runs yet"
            body="Dispatch a mock IngestJob and run the worker locally to see runs appear here."
            hint={{
              label: "Dispatch + run a worker",
              command:
                "pnpm --filter @platform/worker dispatch:mock && pnpm --filter @platform/worker run-worker",
            }}
          />
        ) : (
          <RunsTable runs={runs} />
        )}
      </main>
    </div>
  );
}

function RunsTable({ runs }: { runs: RunSummary[] }) {
  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--bg-elev)", textAlign: "left" }}>
            <Th>Status</Th>
            <Th>Run ID</Th>
            <Th>Store</Th>
            <Th>Supplier</Th>
            <Th>Steps</Th>
            <Th>Cost</Th>
            <Th>Created</Th>
            <Th>Product</Th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <RunRow key={r.runId} run={r} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "10px 14px",
        fontSize: 11,
        letterSpacing: 0.16,
        textTransform: "uppercase",
        color: "var(--text-faint)",
        fontWeight: 600,
        borderBottom: "1px solid var(--border)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td
      style={{
        padding: "10px 14px",
        borderBottom: "1px solid var(--border)",
        verticalAlign: "middle",
        fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
        fontSize: mono ? 12 : 13,
      }}
    >
      {children}
    </td>
  );
}

function RunRow({ run }: { run: RunSummary }) {
  if (run.corrupted) {
    return (
      <tr>
        <Td>
          <CorruptedBadge />
        </Td>
        <Td mono>{run.runId}</Td>
        <Td>—</Td>
        <Td>{run.corrupted.reason}</Td>
        <Td>—</Td>
        <Td>—</Td>
        <Td>—</Td>
        <Td>—</Td>
      </tr>
    );
  }
  return (
    <tr>
      <Td>
        <RunStatusBadge status={run.status} />
      </Td>
      <Td mono>
        <Link
          href={`/runs/${encodeURIComponent(run.runId)}`}
          style={{ color: "var(--text)" }}
        >
          {run.runId}
        </Link>
      </Td>
      <Td>{run.storeId}</Td>
      <Td>
        <span
          style={{
            display: "inline-block",
            maxWidth: 220,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            verticalAlign: "bottom",
          }}
          title={run.supplierUrl}
        >
          {run.supplierUrl || "—"}
        </span>
      </Td>
      <Td>{run.stepCount}</Td>
      <Td>${run.totalCostUsd.toFixed(2)}</Td>
      <Td mono>{run.createdAt ? new Date(run.createdAt).toISOString().replace("T", " ").slice(0, 16) : "—"}</Td>
      <Td>
        {run.finalProductId ? (
          <Link
            href={`/products/${encodeURIComponent(run.storeId)}/${encodeURIComponent(run.finalProductId)}`}
            style={{ color: "var(--accent)" }}
          >
            {run.finalProductId}
          </Link>
        ) : (
          "—"
        )}
      </Td>
    </tr>
  );
}
