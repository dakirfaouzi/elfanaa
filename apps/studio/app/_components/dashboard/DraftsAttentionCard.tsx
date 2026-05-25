import Link from "next/link";

import { EmptyState } from "../EmptyState";
import { RelativeTime } from "../RelativeTime";
import type { DraftListItem } from "@/lib/studio/drafts-service";
import {
  statusLabel,
  statusTagClass,
} from "@/lib/studio/draft-status-options";

/**
 * "Drafts needing attention" card on the operator dashboard.
 *
 * Surfaces drafts the operator must act on next — either AI-generated
 * pages awaiting review (`ready`) or pipeline/publish failures
 * (`failed`). Newest first, capped to the dashboard's `take` budget.
 *
 * Selection logic lives in `pickAttentionDrafts` (pure, tested) — this
 * component just renders the result.
 *
 * # Empty state
 *
 * "Inbox zero" is a legitimate dashboard outcome. We render a calm
 * empty card rather than hiding the section so the operator gets
 * positive feedback that nothing's pending.
 *
 * # Unavailable state
 *
 * When the draft store isn't configured (file-only deployments), the
 * card surfaces a one-line affordance instead of a misleading empty
 * state. Mirrors the discipline used on /drafts itself.
 */
export function DraftsAttentionCard(props: {
  drafts: ReadonlyArray<DraftListItem>;
  /** True when `listDrafts()` returned `mode_unavailable`. */
  unavailable: boolean;
}) {
  return (
    <section
      aria-label="Drafts needing attention"
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
          <span className="section-eyebrow">Triage</span>
          <h2>Drafts needing attention</h2>
        </div>
        <Link href="/drafts" className="btn btn-small">
          See all
        </Link>
      </header>

      {props.unavailable ? (
        <p className="text-dim" style={{ margin: 0, fontSize: 13 }}>
          Draft store unavailable on this deployment.
        </p>
      ) : props.drafts.length === 0 ? (
        <EmptyState
          title="Inbox zero"
          body="No drafts are waiting on review or recovery right now. Newly generated drafts will land here for triage."
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
          {props.drafts.map((draft) => (
            <DraftRow key={draft.id} draft={draft} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DraftRow({ draft }: { draft: DraftListItem }) {
  return (
    <li>
      <Link
        href={`/drafts/${encodeURIComponent(draft.id)}`}
        className="dashboard-row"
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
            title={draft.title}
          >
            {draft.title || draft.slug}
          </span>
          <code
            className="code"
            style={{
              fontSize: 11,
              color: "var(--text-faint)",
              padding: 0,
              background: "transparent",
              border: "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={draft.slug}
          >
            /p/{draft.slug}
          </code>
        </div>
        <span className={statusTagClass(draft.status)}>
          {statusLabel(draft.status)}
        </span>
        <RelativeTime
          value={draft.updatedAt}
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
