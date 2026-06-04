import Link from "next/link";
import { NavBar } from "../_components/NavBar";
import { EmptyState } from "../_components/EmptyState";
import { DraftsBrowser } from "../_components/drafts/DraftsBrowser";
import { listDrafts, type DraftListItem } from "@/lib/studio/drafts-service";
import { bucketStatus } from "@/lib/studio/draft-status-options";

export const dynamic = "force-dynamic";

/**
 * /drafts — the draft list page.
 *
 * Server component. Calls `listDrafts()` which delegates to the
 * persistence factory; when DB persistence is disabled the route
 * surfaces a "enable dual-write" banner.
 *
 * # Why no real "create draft" form here
 *
 * Drafts can also be created via the intake pipeline (M9). The
 * list page exposes a "New draft (blank)" form for builder-only
 * workflows; intake-originated drafts arrive here automatically.
 *
 * # C2 polish layer
 *
 *   • Operator-friendly status labels (no raw `intake` / `generating`
 *     enum names leaking through).
 *   • Counts strip showing how many drafts are in each bucket.
 *   • `<RelativeTime />` for the Updated column so a 2-min-old edit
 *     reads as "2 min ago" instead of a verbose locale-aware
 *     timestamp. The absolute ISO timestamp lives in the `title=`
 *     tooltip for forensic precision.
 *   • Row hover state via the additive `.drafts-row` class.
 *   • Empty state points the operator at the Intake pipeline
 *     (the canonical creation path) instead of leaving them to
 *     guess.
 */
export default async function DraftsPage() {
  const result = await listDrafts();

  return (
    <div className="shell">
      <NavBar active="drafts" />
      <main className="shell-main">
        <header
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            boxShadow:
              "inset 0 1px 0 color-mix(in srgb, var(--text) 4%, transparent)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                  fontWeight: 600,
                }}
              >
                Studio
              </span>
              <h1
                style={{
                  margin: 0,
                  fontFamily: "ui-serif, Georgia, serif",
                  fontSize: 26,
                  letterSpacing: "-0.4px",
                  lineHeight: 1.15,
                }}
              >
                Drafts
              </h1>
            </div>
            <Link
              href="/drafts/new"
              className="btn btn-accent"
              style={{ minHeight: 38, fontWeight: 700 }}
            >
              New draft
            </Link>
          </div>
          {result.ok && result.value.length > 0 ? (
            <DraftCountsStrip drafts={result.value} />
          ) : null}
        </header>

        {!result.ok && result.code === "mode_unavailable" ? (
          <div className="banner">
            Dual-write persistence is disabled. Set
            <code className="code"> STUDIO_PERSISTENCE_MODE=dual</code> and
            <code className="code"> ADMIN_DATABASE_URL</code> to enable the
            draft builder. See
            <code className="code"> docs/M10-MANUAL-SETUP.md</code>.
          </div>
        ) : null}

        {result.ok && result.value.length === 0 ? (
          <EmptyState
            title="No drafts yet"
            body="Run the AI pipeline against a supplier URL from Intake, or create a blank draft above."
            cta={{ href: "/intake", label: "Open Intake" }}
          />
        ) : null}

        {result.ok && result.value.length > 0 ? (
          <DraftsBrowser drafts={result.value} />
        ) : null}
      </main>
    </div>
  );
}

/**
 * Compact counts strip rendered inside the page header. Buckets are
 * defined in `draft-status-options.ts` and rendered in a fixed order
 * so the strip is stable across renders.
 */
function DraftCountsStrip({ drafts }: { drafts: DraftListItem[] }) {
  const buckets = {
    drafts: 0,
    in_progress: 0,
    published: 0,
    archived: 0,
    failed: 0,
  };
  for (const d of drafts) {
    buckets[bucketStatus(d.status)] += 1;
  }

  const cells: Array<{ label: string; count: number; tone: string }> = [
    { label: "Drafts", count: buckets.drafts, tone: "accent" },
    { label: "In progress", count: buckets.in_progress, tone: "info" },
    { label: "Published", count: buckets.published, tone: "success" },
    { label: "Archived", count: buckets.archived, tone: "warning" },
    { label: "Failed", count: buckets.failed, tone: "danger" },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 18,
        flexWrap: "wrap",
        fontSize: 12,
        color: "var(--text-dim)",
        marginTop: 4,
      }}
    >
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
          fontWeight: 600,
        }}
      >
        {drafts.length} total
      </span>
      {cells
        .filter((c) => c.count > 0)
        .map((c) => (
          <span
            key={c.label}
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 6,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span
              style={{
                fontWeight: 700,
                color: `var(--${c.tone})`,
                fontSize: 13,
                letterSpacing: "-0.01em",
              }}
            >
              {c.count}
            </span>
            <span>{c.label}</span>
          </span>
        ))}
    </div>
  );
}
