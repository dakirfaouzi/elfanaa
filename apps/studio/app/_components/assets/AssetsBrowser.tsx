"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { studioPath } from "@/lib/base-path";

/**
 * AssetsBrowser — grid view over `/api/studio/assets`.
 *
 * # Features (per M11 brief)
 *
 *   • Grid view of every uploaded R2 asset.
 *   • Image and video preview.
 *   • Search/filter by content-type (images / videos / all).
 *   • Pagination via the API's createdAt cursor.
 *   • Copy URL.
 *   • Delete with confirm.
 *   • Empty / loading / error states.
 *
 * # Search semantics
 *
 * Client-side filename match — no server-side text search yet
 * (deferred to M12 when we add pgvector + LIKE indices). The
 * content-type filter goes to the server because it scopes the
 * Prisma `findMany` to a cheaper index.
 */

interface AssetItem {
  id: string;
  draftId: string;
  source: string;
  bucket: string;
  key: string;
  contentType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  publicUrl: string;
  altAr: string | null;
  altEn: string | null;
  createdAt: string;
}

type Filter = "all" | "image" | "video";

export function AssetsBrowser() {
  const [items, setItems] = useState<AssetItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (cursor: string | null, reset: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL(
          studioPath("/api/studio/assets"),
          window.location.origin,
        );
        if (filter === "image") url.searchParams.set("contentTypePrefix", "image/");
        if (filter === "video") url.searchParams.set("contentTypePrefix", "video/");
        if (cursor) url.searchParams.set("cursor", cursor);
        const resp = await fetch(url.toString(), { cache: "no-store" });
        if (!resp.ok) {
          throw new Error(`list_failed:${resp.status}`);
        }
        const json = await resp.json();
        const page = json.value?.assets ?? [];
        setNextCursor(json.value?.nextCursor ?? null);
        setItems((prev) => (reset ? page : [...prev, ...page]));
      } catch (err) {
        setError(err instanceof Error ? err.message : "load_failed");
      } finally {
        setLoading(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    void fetchPage(null, true);
  }, [fetchPage]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      [it.key, it.contentType, it.altAr ?? "", it.altEn ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, query]);

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("URL copied");
      setTimeout(() => setFeedback(null), 1200);
    } catch {
      setFeedback("Clipboard unavailable");
    }
  }

  async function remove(asset: AssetItem) {
    if (!window.confirm(`Delete ${shortKey(asset.key)}? This cannot be undone.`)) {
      return;
    }
    const resp = await fetch(
      studioPath(`/api/studio/assets/${encodeURIComponent(asset.id)}`),
      { method: "DELETE" },
    );
    if (!resp.ok) {
      setError(`Delete failed (${resp.status}).`);
      return;
    }
    setItems((prev) => prev.filter((a) => a.id !== asset.id));
    setFeedback("Asset deleted");
    setTimeout(() => setFeedback(null), 1200);
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="toolbar" style={{ position: "static" }}>
        <input
          type="search"
          placeholder="Search by filename or alt text…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ minWidth: 220, flex: 1 }}
        />
        <FilterButton current={filter} value="all" onChange={setFilter}>
          All
        </FilterButton>
        <FilterButton current={filter} value="image" onChange={setFilter}>
          Images
        </FilterButton>
        <FilterButton current={filter} value="video" onChange={setFilter}>
          Videos
        </FilterButton>
      </div>

      {feedback ? <p className="banner success">{feedback}</p> : null}
      {error ? <p className="banner danger">{error}</p> : null}

      {loading && items.length === 0 ? (
        <p className="text-dim">Loading assets…</p>
      ) : filtered.length === 0 ? (
        <p className="empty-card">
          No assets {filter !== "all" ? `(filter: ${filter}) ` : ""}match.
          Upload via a draft's media slot or run the intake pipeline.
        </p>
      ) : (
        <div className="asset-grid">
          {filtered.map((asset) => (
            <article key={asset.id} className="asset-card">
              <div className="asset-thumb">
                {asset.contentType.startsWith("video/") ? (
                  <video src={asset.publicUrl} muted playsInline preload="metadata" />
                ) : (
                  <img src={asset.publicUrl} alt={asset.altEn ?? asset.altAr ?? ""} />
                )}
              </div>
              <div className="asset-meta">
                <span className="filename">{shortKey(asset.key)}</span>
                <span>
                  {asset.contentType} · {formatBytes(asset.bytes)}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-faint)" }}>
                  Draft <code>{asset.draftId}</code>
                </span>
              </div>
              <div className="asset-actions">
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => copyUrl(asset.publicUrl)}
                >
                  Copy URL
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  onClick={() => remove(asset)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {nextCursor ? (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => fetchPage(nextCursor, false)}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function FilterButton(props: {
  current: Filter;
  value: Filter;
  onChange: (v: Filter) => void;
  children: React.ReactNode;
}) {
  const active = props.current === props.value;
  return (
    <button
      type="button"
      className={`btn btn-small${active ? " btn-accent" : ""}`}
      onClick={() => props.onChange(props.value)}
    >
      {props.children}
    </button>
  );
}

function shortKey(key: string): string {
  const parts = key.split("/");
  return parts[parts.length - 1] ?? key;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
