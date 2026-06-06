"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  Archive,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Package,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
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
  status: "live" | "unlisted" | "archived";
  archivedAt: string | null;
  archivedReason: string | null;
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
type StatusFilter = "all" | "live" | "archived" | "unlisted";
type SortKey = "updated" | "created" | "price" | "title" | "orders";

type Toast = { tone: "ok" | "err"; msg: string };
/** A pending archive confirmation — one item (row action) or many (bulk). */
type ArchiveConfirm = { items: Item[] };

export function CatalogClient() {
  const { data, isLoading, error, mutate } = useSWR<Payload>(
    "/api/admin/catalog",
    adminFetcher,
  );

  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("updated");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<ArchiveConfirm | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const items = useMemo(() => data?.items ?? [], [data]);

  const totals = useMemo(() => {
    return {
      total: items.length,
      ai: items.filter((i) => i.source === "ai").length,
      legacy: items.filter((i) => i.source === "legacy").length,
      live: items.filter((i) => i.status === "live").length,
      archived: items.filter((i) => i.status === "archived").length,
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

  /* ── Selection helpers (keyed by slug; slugs are unique per catalog) ── */
  const toggleOne = useCallback((slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const visibleSlugs = useMemo(() => visible.map((i) => i.slug), [visible]);
  const allVisibleSelected =
    visibleSlugs.length > 0 && visibleSlugs.every((s) => selected.has(s));

  const toggleAllVisible = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (visibleSlugs.every((s) => next.has(s))) {
        for (const s of visibleSlugs) next.delete(s);
      } else {
        for (const s of visibleSlugs) next.add(s);
      }
      return next;
    });
  }, [visibleSlugs]);

  const selectedItems = useMemo(
    () => items.filter((i) => selected.has(i.slug)),
    [items, selected],
  );
  const selectedArchivable = selectedItems.filter((i) => i.status !== "archived");
  const selectedRestorable = selectedItems.filter((i) => i.status === "archived");

  /* ── Mutations ── */
  const runArchive = useCallback(
    async (targets: Item[], reason: string | null) => {
      if (targets.length === 0) return;
      const slugs = targets.map((t) => t.slug);
      setPending((prev) => new Set([...prev, ...slugs]));
      let ok = 0;
      let failMsg = "";
      await Promise.all(
        targets.map(async (t) => {
          try {
            const res = await fetch(
              `/api/admin/catalog/${encodeURIComponent(t.slug)}/archive`,
              {
                method: "POST",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ source: t.source, reason }),
              },
            );
            if (res.ok) ok += 1;
            else {
              const b = (await res.json().catch(() => ({}))) as { hint?: string; error?: string };
              failMsg = b.hint || b.error || `HTTP ${res.status}`;
            }
          } catch (err) {
            failMsg = err instanceof Error ? err.message : "network_error";
          }
        }),
      );
      setPending((prev) => {
        const next = new Set(prev);
        for (const s of slugs) next.delete(s);
        return next;
      });
      setSelected(new Set());
      await mutate();
      if (ok === targets.length) {
        setToast({
          tone: "ok",
          msg: `Archived ${ok} product${ok === 1 ? "" : "s"}.`,
        });
      } else {
        setToast({
          tone: "err",
          msg: `Archived ${ok}/${targets.length}. ${failMsg}`.trim(),
        });
      }
    },
    [mutate],
  );

  const runRestore = useCallback(
    async (targets: Item[]) => {
      if (targets.length === 0) return;
      const slugs = targets.map((t) => t.slug);
      setPending((prev) => new Set([...prev, ...slugs]));
      let ok = 0;
      let failMsg = "";
      await Promise.all(
        targets.map(async (t) => {
          try {
            const res = await fetch(
              `/api/admin/catalog/${encodeURIComponent(t.slug)}/restore`,
              { method: "POST", credentials: "same-origin" },
            );
            if (res.ok) ok += 1;
            else {
              const b = (await res.json().catch(() => ({}))) as { hint?: string; error?: string };
              failMsg = b.hint || b.error || `HTTP ${res.status}`;
            }
          } catch (err) {
            failMsg = err instanceof Error ? err.message : "network_error";
          }
        }),
      );
      setPending((prev) => {
        const next = new Set(prev);
        for (const s of slugs) next.delete(s);
        return next;
      });
      setSelected(new Set());
      await mutate();
      if (ok === targets.length) {
        setToast({
          tone: "ok",
          msg: `Restored ${ok} product${ok === 1 ? "" : "s"}.`,
        });
      } else {
        setToast({
          tone: "err",
          msg: `Restored ${ok}/${targets.length}. ${failMsg}`.trim(),
        });
      }
    },
    [mutate],
  );

  if (error) return <ErrorState error={error} />;
  if (isLoading || !data) return <div className="fa-skel" style={{ height: 420 }} />;

  const errors = extractErrors(data);

  return (
    <div className="fa-stack">
      <PartialDataBanner errors={errors} />

      <div
        className="fa-card"
        style={{ padding: "12px 16px", fontSize: 13, color: "rgb(var(--fa-text-muted))" }}
      >
        Manage every storefront product — AI-generated and legacy. <strong>Archive</strong>{" "}
        hides a product everywhere (reversible, order history preserved);{" "}
        <strong>Restore</strong> brings it back. Permanent delete arrives in a later release.
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
        <StatTile label="Archived" value={totals.archived} />
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
            {(["all", "live", "archived", "unlisted"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                className="fa-pill"
                data-active={status === s ? "true" : "false"}
                onClick={() => setStatus(s)}
              >
                {s === "all"
                  ? "All status"
                  : s === "live"
                    ? "Live"
                    : s === "archived"
                      ? "Archived"
                      : "Unlisted"}
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
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      aria-label="Select all visible"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      style={{ cursor: "pointer" }}
                    />
                  </th>
                  <th>Product</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Price</th>
                  <th>Collection</th>
                  <th style={{ textAlign: "right" }}>Orders</th>
                  <th style={{ textAlign: "right" }}>Upsell refs</th>
                  <th>Updated</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visible.map((i) => (
                  <ProductRow
                    key={`${i.source}:${i.id}`}
                    item={i}
                    selected={selected.has(i.slug)}
                    pending={pending.has(i.slug)}
                    onToggle={() => toggleOne(i.slug)}
                    onArchive={() => setConfirm({ items: [i] })}
                    onRestore={() => runRestore([i])}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: "rgb(var(--fa-text-dim))", textAlign: "right" }}>
        Showing {visible.length} of {totals.total}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div
          className="fa-card"
          style={{
            position: "sticky",
            bottom: 12,
            zIndex: 30,
            padding: "12px 16px",
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            boxShadow: "var(--fa-shadow-lift)",
            borderColor: "rgb(var(--fa-accent) / 0.5)",
          }}
        >
          <strong style={{ fontSize: 13 }}>{selected.size} selected</strong>
          <div className="fa-row" style={{ gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
            {selectedArchivable.length > 0 && (
              <button
                type="button"
                className="fa-btn"
                onClick={() => setConfirm({ items: selectedArchivable })}
              >
                <Archive size={13} /> Archive ({selectedArchivable.length})
              </button>
            )}
            {selectedRestorable.length > 0 && (
              <button
                type="button"
                className="fa-btn"
                data-tone="primary"
                onClick={() => runRestore(selectedRestorable)}
              >
                <RotateCcw size={13} /> Restore ({selectedRestorable.length})
              </button>
            )}
            <button
              type="button"
              className="fa-btn"
              data-tone="ghost"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {confirm && (
        <ArchiveDialog
          items={confirm.items}
          onCancel={() => setConfirm(null)}
          onConfirm={(reason) => {
            const targets = confirm.items;
            setConfirm(null);
            void runArchive(targets, reason);
          }}
        />
      )}

      {toast && (
        <div
          className="fa-toast"
          role="status"
          style={{
            borderColor:
              toast.tone === "ok"
                ? "rgb(var(--fa-positive) / 0.5)"
                : "rgb(var(--fa-danger) / 0.5)",
          }}
        >
          <span className="fa-row" style={{ gap: 8, alignItems: "center" }}>
            {toast.tone === "ok" ? (
              <CheckCircle2 size={15} style={{ color: "rgb(var(--fa-positive))" }} />
            ) : (
              <AlertTriangle size={15} style={{ color: "rgb(var(--fa-danger))" }} />
            )}
            {toast.msg}
          </span>
        </div>
      )}
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

function StatusBadge({ status }: { status: Item["status"] }) {
  if (status === "live") {
    return (
      <span className="fa-tag" data-tone="positive">
        Live
      </span>
    );
  }
  if (status === "archived") {
    return (
      <span className="fa-tag" data-tone="warn">
        Archived
      </span>
    );
  }
  return <span className="fa-tag">Unlisted</span>;
}

function ProductRow({
  item,
  selected,
  pending,
  onToggle,
  onArchive,
  onRestore,
}: {
  item: Item;
  selected: boolean;
  pending: boolean;
  onToggle: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const viewHref = item.landingPath ?? `/products/${item.slug}`;
  const canView = item.status === "live";

  return (
    <tr className="fa-row-static" data-selected={selected ? "true" : undefined}>
      <td data-label="Select" style={{ width: 36 }}>
        <input
          type="checkbox"
          aria-label={`Select ${item.titleEn}`}
          checked={selected}
          onChange={onToggle}
          disabled={pending}
          style={{ cursor: pending ? "not-allowed" : "pointer" }}
        />
      </td>
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
              opacity: item.placeholderImage || item.status === "archived" ? 0.55 : 1,
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
        <StatusBadge status={item.status} />
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
      <td data-label="Actions">
        <div className="fa-row" style={{ gap: 6, justifyContent: "flex-end" }}>
          {canView && (
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
          )}
          {item.status === "archived" ? (
            <button
              type="button"
              className="fa-btn"
              data-tone="primary"
              onClick={onRestore}
              disabled={pending}
            >
              <RotateCcw size={13} /> {pending ? "Restoring…" : "Restore"}
            </button>
          ) : (
            <button
              type="button"
              className="fa-btn"
              onClick={onArchive}
              disabled={pending}
            >
              <Archive size={13} /> {pending ? "Archiving…" : "Archive"}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * Archive confirmation dialog. Surfaces the "where used" blast radius (inbound
 * upsell refs, order history, bespoke landing pages) so an operator archives
 * with eyes open. Reason is optional and recorded as `archivedBy`'s note.
 */
function ArchiveDialog({
  items,
  onCancel,
  onConfirm,
}: {
  items: Item[];
  onCancel: () => void;
  onConfirm: (reason: string | null) => void;
}) {
  const [reason, setReason] = useState("");
  const bulk = items.length > 1;
  const refs = items.reduce((n, i) => n + i.inboundUpsellRefs, 0);
  const orders = items.reduce((n, i) => n + (i.orders ?? 0), 0);
  const landings = items.filter((i) => i.landingPath);

  return (
    <div
      className="fa-drawer-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm archive"
      onClick={onCancel}
      style={{ display: "grid", placeItems: "center", padding: 16 }}
    >
      <div
        className="fa-card fa-card-pad-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460 }}
      >
        <div className="fa-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 17,
              fontFamily: "ui-serif, Georgia, serif",
              color: "rgb(var(--fa-text))",
            }}
          >
            {bulk ? `Archive ${items.length} products?` : "Archive this product?"}
          </div>
          <button
            type="button"
            className="fa-btn"
            data-tone="ghost"
            onClick={onCancel}
            aria-label="Close"
            style={{ padding: 6 }}
          >
            <X size={15} />
          </button>
        </div>

        {!bulk && (
          <div style={{ marginTop: 10, fontSize: 14, color: "rgb(var(--fa-text))" }}>
            <strong>{items[0].titleEn}</strong>{" "}
            <code style={{ fontSize: 11 }}>{items[0].slug}</code>
          </div>
        )}

        <p style={{ marginTop: 12, fontSize: 13.5, color: "rgb(var(--fa-text-muted))", lineHeight: 1.5 }}>
          Archiving hides {bulk ? "these products" : "it"} from the storefront — shop,
          collections, home best-sellers, and the product page (which will 404). This is
          reversible: order history is preserved and you can Restore at any time.
        </p>

        {(refs > 0 || orders > 0 || landings.length > 0) && (
          <div
            className="fa-card"
            style={{
              marginTop: 12,
              padding: "10px 12px",
              background: "rgb(var(--fa-warn) / 0.08)",
              borderColor: "rgb(var(--fa-warn) / 0.42)",
              fontSize: 12.5,
              color: "rgb(var(--fa-text))",
            }}
          >
            <div className="fa-row" style={{ gap: 8, alignItems: "flex-start" }}>
              <AlertTriangle
                size={15}
                style={{ color: "rgb(var(--fa-warn))", flexShrink: 0, marginTop: 1 }}
              />
              <ul style={{ margin: 0, paddingInlineStart: 16, display: "grid", gap: 4 }}>
                {refs > 0 && (
                  <li>
                    Referenced as an upsell / cross-sell by {formatNumber(refs)} other
                    placement{refs === 1 ? "" : "s"} — those recommendations will drop it.
                  </li>
                )}
                {orders > 0 && (
                  <li>
                    Has {formatNumber(orders)} order line-item{orders === 1 ? "" : "s"} —
                    order history stays intact.
                  </li>
                )}
                {landings.length > 0 && (
                  <li>
                    {bulk ? `${landings.length} have` : "Has"} a bespoke landing page
                    {bulk ? "" : ` (${landings[0].landingPath})`} that will 404 after archiving.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        <label style={{ display: "block", marginTop: 14, fontSize: 12.5, color: "rgb(var(--fa-text-muted))" }}>
          Reason (optional)
          <input
            className="fa-input"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Out of stock, replaced by v2…"
            maxLength={280}
            style={{ width: "100%", marginTop: 6 }}
          />
        </label>

        <div className="fa-row" style={{ gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
          <button type="button" className="fa-btn" data-tone="ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="fa-btn"
            onClick={() => onConfirm(reason.trim() ? reason.trim() : null)}
          >
            <Archive size={13} /> {bulk ? `Archive ${items.length}` : "Archive"}
          </button>
        </div>
      </div>
    </div>
  );
}
