"use client";

import { useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import useSWR from "swr";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { OrderDrawer } from "./OrderDrawer";
import { formatCurrency, formatDate, formatNumber } from "../_components/format";
import {
  adminFetcher,
  ErrorState,
  PartialDataBanner,
  extractErrors,
} from "../_components/data";

type Row = {
  id: string;
  createdAt: string;
  customerName: string;
  phone: string;
  city: string | null;
  countryCode: string | null;
  itemCount: number;
  totalMinor: number;
  currency: string;
  status: string;
  hasUpsell: boolean;
  hasCrossSell: boolean;
  sourcePath: string | null;
};

export function OrdersClient() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState<string | null>(null);

  const qs = params?.toString() ?? "";
  const { data, error, isLoading } = useSWR<{
    rows: Row[];
    total: number;
    page: number;
    pages: number;
    pageSize: number;
    _errors?: Array<{ label: string; error: string }>;
  }>(`/api/admin/orders?${qs}`, adminFetcher);

  const setParam = (k: string, v?: string) => {
    const sp = new URLSearchParams(params?.toString());
    if (v) sp.set(k, v);
    else sp.delete(k);
    router.replace(`${pathname}?${sp.toString()}`);
  };

  const status = params?.get("status") ?? "";
  const page = Number(params?.get("page") ?? "1");

  if (error) return <ErrorState error={error} />;

  const errors = extractErrors(data);

  return (
    <div className="fa-stack">
      <PartialDataBanner errors={errors} />
      <div className="fa-card">
        <div className="fa-row" style={{ flexWrap: "wrap", gap: 12 }}>
          <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 420 }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "rgb(110,118,132)",
              }}
            />
            <input
              type="search"
              className="fa-input"
              placeholder="Search by name, phone, city, order id…"
              defaultValue={params?.get("q") ?? ""}
              onChange={(e) => {
                const v = e.currentTarget.value.trim();
                clearTimeout((globalThis as any).__faSearchTimer);
                (globalThis as any).__faSearchTimer = setTimeout(() => setParam("q", v || undefined), 350);
              }}
              style={{ paddingLeft: 34 }}
            />
          </div>
          <div className="fa-pill-row">
            {["", "pending", "shipped", "delivered", "cancelled"].map((s) => (
              <button
                key={s || "all"}
                className="fa-pill"
                data-active={(s === status).toString()}
                onClick={() => setParam("status", s || undefined)}
              >
                {s || "All"}
              </button>
            ))}
          </div>
          <select
            className="fa-input"
            style={{ maxWidth: 200 }}
            defaultValue={params?.get("sort") ?? "created_desc"}
            onChange={(e) => setParam("sort", e.target.value)}
          >
            <option value="created_desc">Newest first</option>
            <option value="created_asc">Oldest first</option>
            <option value="total_desc">Highest total</option>
            <option value="total_asc">Lowest total</option>
          </select>
        </div>
      </div>

      <div className="fa-card" style={{ padding: 0, overflow: "hidden" }}>
        {isLoading || !data ? (
          <div className="fa-empty">Loading…</div>
        ) : data.rows.length === 0 ? (
          <div className="fa-empty"><strong>No orders in range</strong>Once orders flow in, they appear here.</div>
        ) : (
          <table className="fa-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>City</th>
                <th style={{ textAlign: "right" }}>Items</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} onClick={() => setActive(r.id)}>
                  <td>
                    <code style={{ fontSize: 11.5 }}>{r.id}</code>
                    <div style={{ marginTop: 4, display: "flex", gap: 4 }}>
                      {r.hasUpsell && <span className="fa-tag" data-tone="accent">upsell</span>}
                      {r.hasCrossSell && <span className="fa-tag" data-tone="positive">cross-sell</span>}
                    </div>
                  </td>
                  <td>{r.customerName}</td>
                  <td className="fa-mono">{r.phone}</td>
                  <td>{r.city ?? "—"}</td>
                  <td className="fa-mono" style={{ textAlign: "right" }}>{formatNumber(r.itemCount)}</td>
                  <td className="fa-mono" style={{ textAlign: "right" }}>{formatCurrency(r.totalMinor, r.currency)}</td>
                  <td><StatusTag status={r.status} /></td>
                  <td className="fa-mono" style={{ color: "rgb(158,165,180)" }}>{formatDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.pages > 1 && (
        <div className="fa-row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="fa-btn" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>
            <ChevronLeft size={14} /> Prev
          </button>
          <span style={{ fontSize: 12.5, color: "rgb(158,165,180)", padding: "0 6px" }}>
            Page {page} of {data.pages}
          </span>
          <button className="fa-btn" disabled={page >= data.pages} onClick={() => setParam("page", String(page + 1))}>
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}

      {active && <OrderDrawer id={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const tone =
    status === "delivered"
      ? "positive"
      : status === "shipped"
      ? "accent"
      : status === "cancelled"
      ? "danger"
      : "warn";
  return <span className="fa-tag" data-tone={tone}>{status}</span>;
}
