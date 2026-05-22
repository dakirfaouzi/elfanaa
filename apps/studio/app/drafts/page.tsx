import Link from "next/link";
import { NavBar } from "../_components/NavBar";
import { EmptyState } from "../_components/EmptyState";
import { listDrafts } from "@/lib/studio/drafts-service";

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
 */
export default async function DraftsPage() {
  const result = await listDrafts();

  return (
    <div className="shell">
      <NavBar active="drafts" />
      <main className="shell-main">
        <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontFamily: "ui-serif, Georgia, serif" }}>
            Drafts
          </h1>
          <div style={{ flex: 1 }} />
          <Link href="/drafts/new" className="btn btn-accent">
            New draft
          </Link>
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
            body="Create a draft above, or run the intake pipeline against a supplier URL."
          />
        ) : null}

        {result.ok && result.value.length > 0 ? (
          <section className="section-card">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "start", borderBottom: "1px solid var(--border)" }}>
                  <th style={th}>Title</th>
                  <th style={th}>Slug</th>
                  <th style={th}>Status</th>
                  <th style={th}>Updated</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {result.value.map((d) => (
                  <tr key={d.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={td}>{d.title}</td>
                    <td style={td}>
                      <code className="code">{d.slug}</code>
                    </td>
                    <td style={td}>
                      <span className={`tag tag-${tagForStatus(d.status)}`}>
                        {d.status}
                      </span>
                    </td>
                    <td style={td}>
                      <time dateTime={d.updatedAt}>
                        {new Date(d.updatedAt).toLocaleString()}
                      </time>
                    </td>
                    <td style={{ ...td, textAlign: "end" }}>
                      <Link
                        href={`/drafts/${encodeURIComponent(d.id)}`}
                        className="btn btn-small"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
      </main>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "10px 8px",
  fontWeight: 600,
  color: "var(--text-dim)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.14,
};
const td: React.CSSProperties = {
  padding: "10px 8px",
};

function tagForStatus(status: string): string {
  switch (status) {
    case "published":
      return "success";
    case "failed":
      return "danger";
    case "generating":
    case "publishing":
      return "info";
    case "archived":
      return "warning";
    default:
      return "accent";
  }
}
