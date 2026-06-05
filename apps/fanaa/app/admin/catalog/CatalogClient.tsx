"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { ExternalLink, Search, Sparkles, Package } from "lucide-react";
import { formatCurrency, formatNumber, formatDate } from "../_components/format";
import {
  adminFetcher,
  ErrorState,
  PartialDataBanner,
  extractErrors,
} from "../_components/data";

/* Mirror of `CatalogInventoryItem` (lib/admin/catalog-inventory.ts). */
type Item = {
  id: string;
  slug: string;
  titleEn: string;
  titleAr: string;
  source: "ai" | "legacy";
  status: "live" | "unlisted";
  priceMinor: number;
  priceCurrency: string;
  collection: string | null;
  hasDbRow: boolean;
  landingPath: string | null;
  imageSrc: string;
  placeholderImage: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  orders: number | null;
  inboundUpsellRefs: number;
};

type Payload = { items: Item[]; _errors?: Array<{ label: string; error: string }> };

type SourceFilter = "all" | "ai" | "legacy";
type StatusFilter = "all" | "live" | "unlisted";
type SortKey = "updated" | "created" | "price" | "title" | "orders";

export function CatalogClient() {
  const { data, isLoading, error } = useSWR<Payload>("/api/admin/catalog", adminFetcher);

  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("updated");

  const items = useMemo(() => data?.items ?? [], [data]);

  const totals = useMemo(() => {
    return {
      total: items.length,
      ai: items.filter((i) => i.source === "ai").length,
      legacy: items.filter((i) => i.source === "legacy").length,
      live: items.filter((i) => i.status === "live").length,
      unlisted: items.filter((i) => i.status === "unlisted").length,
    };
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((i) => {
      if (source !== "all" && i.source !== source) return false;
      if (status !== "all" && i.status !== status) return false;
      if (q) {
        const hay = `${i.titleEn} ${i.titleAr} ${i.slug} ${i.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const ts = (v: string | null) => (v ? new Date(v).getTime() : 0);
    const sorted = [...filtered];
    switch (sort) {
      case "title":
        sorted.sort((a, b) => a.titleEn.localeCompare(b.titleEn));
        break;
      case "price":
        sorted.sort((a, b) => b.priceMinor - a.priceMinor);
        break;
      case "orders":
        sorted.sort((a, b) => (b.orders ?? -1) - (a.orders ?? -1));
        break;
      case "created":
        sorted.sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
        break;
      case "updated":
      default:
        sorted.sort((a, b) => ts(b.updatedAt) - ts(a.updatedAt));
        break;
    }
    return sorted;
  }, [items, query, source, status, sort]);

  if (error) return <ErrorState error={error} />;
  if (isLoading || !data) return <div className="fa-skel" style={{ height: 420 }} />;

  const errors = extractErrors(data);

  return (
    <div className="fa-stack">
      <PartialDataBanner errors={errors} />

      {/* Read-only notice — sets expectations until archive/restore ships. */}
      <div
        className="fa-card"
        style={{ padding: "12px 16px", fontSize: 13, color: "rgb(var(--fa-text-muted))" }}
      >
        Read-only inventory of every storefront product — AI-generated and legacy.
        Archive, restore, and delete arrive in a later release.
      </div>

      {/* Summary tiles */}
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        }}
      >
        <StatTile label="Total" value={totals.total} />
        <StatTile label="AI-generated" value={totals.ai} />
        <StatTile label="Legacy" value={totals.legacy} />
        <StatTile label="Live" value={totals.live} />
        <StatTile label="Unlisted" value={totals.unlisted} />
      </div>

      {/* Controls */}
      <div className="fa-card" style={{ padding: 14 }}>
        <div className="fa-row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label className="fa-row" style={{ gap: 8, flex: "1 1 240px", minWidth: 200 }}>
            <Search size={15} style={{ color: "rgb(var(--fa-text-dim))", flexShrink: 0 }} />
            <input
              className="fa-input"
              type="search"
              placeholder="Search by title, slug or id…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>

          <div className="fa-pill-row" role="group" aria-label="Filter by source">
            {(["all", "ai", "legacy"] as SourceFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                className="fa-pill"
                data-active={source === s ? "true" : "false"}
                onClick={() => setSource(s)}
              >
                {s === "all" ? "All sources" : s === "ai" ? "AI" : "Legacy"}
              </button>
            ))}
          </div>

          <div className="fa-pill-row" role="group" aria-label="Filter by status">
            {(["all", "live", "unlisted"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                className="fa-pill"
                data-active={status === s ? "true" : "false"}
                onClick={() => setStatus(s)}
              >
                {s === "all" ? "All status" : s === "live" ? "Live" : "Unlisted"}
              </button>
            ))}
          </div>

          <select
            className="fa-input"
            aria-label="Sort products"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            style={{ flex: "0 0 auto" }}
          >
            <option value="updated">Sort: Updated</option>
            <option value="created">Sort: Created</option>
            <option value="price">Sort: Price</option>
            <option value="orders">Sort: Orders</option>
            <option value="title">Sort: Title</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="fa-card" style={{ padding: 0, overflow: "hidden" }}>
        {items.length === 0 ? (
          <div className="fa-empty">
            <strong>No products yet</strong>
            Publish a product from Studio, or seed the curated catalog.
          </div>
        ) : visible.length === 0 ? (
          <div className="fa-empty">
            <strong>No products match these filters</strong>
            Try clearing the search or switching source / status.
          </div>
        ) : (
          <div className="fa-table-wrap">
            <table className="fa-table fa-table-stack">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Price</th>
                  <th>Collection</th>
                  <th style={{ textAlign: "right" }}>Orders</th>
                  <th style={{ textAlign: "right" }}>Upsell refs</th>
                  <th>Updated</th>
                  <th aria-label="View" />
                </tr>
              </thead>
              <tbody>
                {visible.map((i) => (
                  <ProductRow key={`${i.source}:${i.id}`} item={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: "rgb(var(--fa-text-dim))", textAlign: "right" }}>
        Showing {visible.length} of {totals.total}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="fa-card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 12, color: "rgb(var(--fa-text-dim))", letterSpacing: "0.02em" }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 600,
          fontFamily: "ui-serif, Georgia, serif",
          color: "rgb(var(--fa-text))",
          marginTop: 2,
        }}
      >
        {formatNumber(value)}
      </div>
    </div>
  );
}

function ProductRow({ item }: { item: Item }) {
  const viewHref = item.landingPath ?? `/products/${item.slug}`;
  const canView = item.status === "live";

  return (
    <tr className="fa-row-static">
      <td data-label="Product">
        <div className="fa-row" style={{ gap: 10, alignItems: "center" }}>
          <span
            aria-hidden
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              flexShrink: 0,
              backgroundColor: "rgb(var(--fa-bg-2))",
              backgroundImage: `url("${item.imageSrc}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              border: "1px solid rgb(var(--fa-line))",
              opacity: item.placeholderImage ? 0.55 : 1,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {item.titleEn}
            </div>
            <code style={{ fontSize: 11, color: "rgb(var(--fa-text-dim))" }}>{item.slug}</code>
          </div>
        </div>
      </td>
      <td data-label="Source">
        {item.source === "ai" ? (
          <span className="fa-tag" data-tone="accent">
            <Sparkles size={12} /> AI
          </span>
        ) : (
          <span className="fa-tag">
            <Package size={12} /> Legacy
          </span>
        )}
      </td>
      <td data-label="Status">
        <span className="fa-tag" data-tone={item.status === "live" ? "positive" : "warn"}>
          {item.status === "live" ? "Live" : "Unlisted"}
        </span>
      </td>
      <td data-label="Price" data-align="right" className="fa-mono" style={{ textAlign: "right" }}>
        {formatCurrency(item.priceMinor, item.priceCurrency)}
      </td>
      <td data-label="Collection">{item.collection ?? "—"}</td>
      <td data-label="Orders" data-align="right" className="fa-mono" style={{ textAlign: "right" }}>
        {item.orders == null ? "—" : formatNumber(item.orders)}
      </td>
      <td data-label="Upsell refs" data-align="right" className="fa-mono" style={{ textAlign: "right" }}>
        {formatNumber(item.inboundUpsellRefs)}
      </td>
      <td data-label="Updated" style={{ whiteSpace: "nowrap", color: "rgb(var(--fa-text-muted))" }}>
        {item.updatedAt ? formatDate(item.updatedAt) : "—"}
      </td>
      <td data-label="View">
        {canView ? (
          <a
            className="fa-btn"
            data-tone="ghost"
            href={viewHref}
            target="_blank"
            rel="noopener noreferrer"
            title="Open on storefront"
          >
            <ExternalLink size={13} /> View
          </a>
        ) : (
          <span style={{ fontSize: 12, color: "rgb(var(--fa-text-dim))" }}>—</span>
        )}
      </td>
    </tr>
  );
}
