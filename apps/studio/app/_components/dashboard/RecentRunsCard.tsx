import Link from "next/link";

import { CorruptedBadge, RunStatusBadge } from "../StatusBadge";
import { EmptyState } from "../EmptyState";
import { RelativeTime } from "../RelativeTime";
import type { RunSummary } from "@/lib/studio/run-loader";

/**
 * "Recent runs" card on the operator dashboard.
 *
 * Renders the most-recent pipeline executions newest-first with their
 * status, supplier hostname (the operator's main scan-key), and a
 * live relative timestamp. Each row links to the run detail page so
 * the operator can drill into a stuck run with one click.
 *
 * # Why no corrupted filter
 *
 * Corrupted run records ARE surfaced — the operator needs to know
 * they exist. They get a `Corrupted` badge instead of the normal
 * status pill, which matches the existing /runs list discipline.
 *
 * # Empty state
 *
 * The empty card surfaces an Intake CTA. New deployments hit this
 * surface before they have any runs; routing them straight to the
 * supplier-URL flow is faster than a generic "no data" splash.
 */
export function RecentRunsCard(props: { runs: ReadonlyArray<RunSummary> }) {
  return (
    <section
      aria-label="Recent runs"
      className="section-card"
      style={{ minWidth: 0 }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="section-eyebrow">Pipeline</span>
          <h2>Recent runs</h2>
        </div>
        <Link
          href="/runs"
          className="btn btn-small"
          aria-label="Open the full runs list"
        >
          See all
        </Link>
      </header>

      {props.runs.length === 0 ? (
        <EmptyState
          title="No runs yet"
          body="Kick off a pipeline from Intake — paste a supplier URL and the AI takes it from there."
          cta={{ href: "/intake", label: "Open Intake" }}
        />
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {props.runs.map((run) => (
            <RunRow key={run.runId} run={run} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RunRow({ run }: { run: RunSummary }) {
  const supplierHost = safeHostname(run.supplierUrl);
  return (
    <li>
      <Link
        href={`/runs/${encodeURIComponent(run.runId)}`}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto auto",
          alignItems: "center",
          gap: 12,
          padding: "10px 12px",
          borderRadius: "var(--radius)",
          textDecoration: "none",
          color: "var(--text)",
          border: "1px solid transparent",
          transition:
            "border-color var(--transition-fast) var(--ease-out), background var(--transition-fast) var(--ease-out)",
          background: "transparent",
        }}
        className="dashboard-row"
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={run.supplierUrl}
          >
            {supplierHost}
          </span>
          <span
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              fontSize: 11,
              color: "var(--text-faint)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {run.runId}
          </span>
        </div>
        {run.corrupted ? (
          <CorruptedBadge />
        ) : (
          <RunStatusBadge status={run.status} />
        )}
        <RelativeTime
          value={run.createdAt}
          liveRefreshMs={30_000}
          style={{
            fontSize: 12,
            color: "var(--text-dim)",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        />
      </Link>
    </li>
  );
}

/**
 * Extract a clean hostname from a supplier URL. Falls back to the raw
 * string when parsing fails so the row never collapses to "—".
 */
function safeHostname(supplierUrl: string): string {
  try {
    const u = new URL(supplierUrl);
    return u.hostname.replace(/^www\./, "") || supplierUrl;
  } catch {
    return supplierUrl;
  }
}
