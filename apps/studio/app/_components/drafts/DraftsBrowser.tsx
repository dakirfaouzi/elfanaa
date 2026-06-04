"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RelativeTime } from "../RelativeTime";
import { StatusIcon } from "../StatusIcon";
import type { DraftListItem } from "@/lib/studio/drafts-service";
import {
  bucketStatus,
  statusGlyphKind,
  statusLabel,
  statusTagClass,
} from "@/lib/studio/draft-status-options";

/**
 * DraftsBrowser — client-side search / filter / sort over the draft list
 * (Sprint 2).
 *
 * # Why client-side
 *
 * `listDrafts()` already returns the full set for the store and the list
 * is small (operator-scale, not catalog-scale). Filtering in the browser
 * gives *instant* feedback with zero extra round-trips and needs no new
 * API surface or schema change — exactly the Sprint 2 constraint.
 *
 * The server page still owns data-fetching and the totals strip; this
 * component only owns the interactive table.
 */

type FilterKey = "all" | "draft" | "published" | "running" | "failed";
type SortKey = "updated" | "newest" | "oldest" | "published";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "published", label: "Published" },
  { key: "running", label: "Running" },
  { key: "failed", label: "Failed" },
];

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "updated", label: "Last updated" },
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "published", label: "Published date" },
];

/** Map a draft status to the filter bucket. Reuses the canonical model. */
function matchesFilter(status: DraftListItem["status"], filter: FilterKey): boolean {
  if (filter === "all") return true;
  const bucket = bucketStatus(status);
  switch (filter) {
    case "draft":
      return bucket === "drafts";
    case "published":
      return bucket === "published";
    case "running":
      return bucket === "in_progress";
    case "failed":
      return bucket === "failed";
  }
}

function compareDrafts(a: DraftListItem, b: DraftListItem, sort: SortKey): number {
  switch (sort) {
    case "newest":
      return b.createdAt.localeCompare(a.createdAt);
    case "oldest":
      return a.createdAt.localeCompare(b.createdAt);
    case "published": {
      // Published-date desc, nulls (never-published) last.
      if (!a.publishedAt && !b.publishedAt) {
        return b.updatedAt.localeCompare(a.updatedAt);
      }
      if (!a.publishedAt) return 1;
      if (!b.publishedAt) return -1;
      return b.publishedAt.localeCompare(a.publishedAt);
    }
    case "updated":
    default:
      return b.updatedAt.localeCompare(a.updatedAt);
  }
}

export function DraftsBrowser({ drafts }: { drafts: DraftListItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("updated");

  // Per-filter counts for the chip badges — derived from the full set so
  // they stay stable regardless of the active search/filter.
  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: drafts.length,
      draft: 0,
      published: 0,
      running: 0,
      failed: 0,
    };
    for (const d of drafts) {
      const bucket = bucketStatus(d.status);
      if (bucket === "drafts") c.draft += 1;
      else if (bucket === "published") c.published += 1;
      else if (bucket === "in_progress") c.running += 1;
      else if (bucket === "failed") c.failed += 1;
    }
    return c;
  }, [drafts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drafts
      .filter((d) => matchesFilter(d.status, filter))
      .filter((d) => {
        if (!q) return true;
        return (
          d.title.toLowerCase().includes(q) ||
          d.slug.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => compareDrafts(a, b, sort));
  }, [drafts, query, filter, sort]);

  const filtersActive = query.trim() !== "" || filter !== "all";

  return (
    <section className="section-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Controls row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, slug, or draft id…"
            aria-label="Search drafts"
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--surface-2, var(--surface))",
              color: "var(--text)",
              fontSize: 13,
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Filter by status">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={active}
                className={active ? "btn btn-small btn-accent" : "btn btn-small"}
                style={{ fontWeight: active ? 700 : 500 }}
              >
                {f.label}
                <span
                  style={{
                    marginInlineStart: 6,
                    opacity: 0.7,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>

        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--text-dim)",
          }}
        >
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort drafts"
            style={{
              padding: "6px 10px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--surface-2, var(--surface))",
              color: "var(--text)",
              fontSize: 13,
            }}
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Results */}
      {visible.length > 0 ? (
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
            {visible.map((d) => (
              <tr
                key={d.id}
                className="drafts-row"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <td style={td}>
                  <span style={{ fontWeight: 600, letterSpacing: "-0.01em" }}>{d.title}</span>
                </td>
                <td style={td}>
                  <code className="code" title={d.slug}>
                    {d.slug}
                  </code>
                </td>
                <td style={td}>
                  <span className={statusTagClass(d.status)}>
                    <StatusIcon kind={statusGlyphKind(d.status)} />
                    {statusLabel(d.status)}
                  </span>
                </td>
                <td style={td}>
                  <RelativeTime
                    value={d.updatedAt}
                    liveRefreshMs={30_000}
                    style={{
                      fontSize: 12,
                      color: "var(--text-dim)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
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
      ) : (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            color: "var(--text-dim)",
            fontSize: 13,
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: "var(--text)" }}>
            No drafts match your search
          </p>
          <p style={{ margin: "6px 0 0" }}>
            Try a different keyword{filter !== "all" ? " or status filter" : ""}.
          </p>
          {filtersActive ? (
            <button
              type="button"
              className="btn btn-small"
              style={{ marginTop: 12 }}
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      )}
    </section>
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
