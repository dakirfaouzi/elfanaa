"use client";

import { useEffect, useState } from "react";
import { X, Copy, Save } from "lucide-react";
import useSWR, { mutate } from "swr";
import { formatCurrency, formatDate, formatNumber } from "../_components/format";

type OrderDetail = {
  id: string;
  createdAt: string;
  customerName: string;
  phone: string;
  phoneE164: string | null;
  city: string | null;
  address: string | null;
  countryCode: string | null;
  status: string;
  notes: string | null;
  paymentMethod: string;
  subtotalMinor: number;
  totalMinor: number;
  currency: string;
  itemCount: number;
  hasUpsell: boolean;
  hasCrossSell: boolean;
  sourcePath: string | null;
  items: Array<{
    id: string;
    productId: string;
    productSlug: string | null;
    title: string;
    quantity: number;
    unitMinor: number;
    totalMinor: number;
    source: string;
  }>;
  session?: {
    id: string;
    device: string | null;
    browser: string | null;
    os: string | null;
    countryCode: string | null;
    region: string | null;
    city: string | null;
    isp: string | null;
    startedAt: string;
    isValid: boolean;
    qualityScore: number;
    traffic?: { flags: string[] | null; reason: string | null } | null;
  } | null;
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error("fetch_failed");
  return res.json();
};

const STATUS_OPTIONS = ["pending", "shipped", "delivered", "cancelled"] as const;

/**
 * Drawer-style order preview. Editorial layout — left rail customer + meta,
 * right rail items + timeline. Status dropdown writes back via PATCH and
 * revalidates the list silently.
 */
export function OrderDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = useSWR<OrderDetail>(`/api/admin/orders/${id}`, fetcher);
  const [status, setStatus] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setStatus(data.status);
      setNotes(data.notes ?? "");
    }
  }, [data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!data) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/orders/${data.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      await mutate(`/api/admin/orders/${data.id}`);
      // The list might also need a refresh — wildcard SWR refresh.
      await mutate((key: string) => typeof key === "string" && key.startsWith("/api/admin/orders?"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fa-drawer-overlay" onClick={onClose} />
      <aside className="fa-drawer" role="dialog" aria-label="Order details">
        <div className="fa-drawer-header">
          <div>
            <div className="fa-meta">Order</div>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, marginTop: 2 }}>{id}</div>
          </div>
          <button className="fa-btn" data-tone="ghost" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <div className="fa-drawer-body">
          {isLoading || !data ? (
            <div className="fa-skel" style={{ height: 360 }} />
          ) : (
            <div className="fa-stack">
              {/* Customer */}
              <section className="fa-card" style={{ padding: 16 }}>
                <div className="fa-meta">Customer</div>
                <div style={{ fontSize: 18, marginTop: 4 }}>{data.customerName}</div>
                <div className="fa-stack-sm" style={{ marginTop: 10, fontSize: 13 }}>
                  <CopyRow label="Phone" value={data.phoneE164 ?? data.phone} />
                  {data.city && <CopyRow label="City" value={data.city} />}
                  {data.address && <CopyRow label="Address" value={data.address} />}
                </div>
              </section>

              {/* Items */}
              <section className="fa-card" style={{ padding: 16 }}>
                <div className="fa-meta">Line items</div>
                <table className="fa-table" style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: "right" }}>Qty</th>
                      <th style={{ textAlign: "right" }}>Unit</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((it) => (
                      <tr key={it.id} style={{ cursor: "default" }}>
                        <td>
                          {it.title}
                          {it.source !== "base" && (
                            <span className="fa-tag" data-tone="accent" style={{ marginLeft: 6 }}>
                              {it.source.replace("_", "-")}
                            </span>
                          )}
                        </td>
                        <td className="fa-mono" style={{ textAlign: "right" }}>{it.quantity}</td>
                        <td className="fa-mono" style={{ textAlign: "right" }}>{formatCurrency(it.unitMinor, data.currency)}</td>
                        <td className="fa-mono" style={{ textAlign: "right" }}>{formatCurrency(it.totalMinor, data.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <hr className="fa-rule" />
                <div className="fa-row">
                  <span className="fa-meta">Subtotal</span>
                  <span className="fa-mono">{formatCurrency(data.subtotalMinor, data.currency)}</span>
                </div>
                <div className="fa-row">
                  <span style={{ fontWeight: 500 }}>Total</span>
                  <span className="fa-mono" style={{ fontSize: 18 }}>{formatCurrency(data.totalMinor, data.currency)}</span>
                </div>
              </section>

              {/* Status + notes */}
              <section className="fa-card" style={{ padding: 16 }}>
                <div className="fa-meta">Operations</div>
                <div className="fa-stack-sm" style={{ marginTop: 8 }}>
                  <select className="fa-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <textarea
                    className="fa-input"
                    rows={3}
                    placeholder="Internal notes (not shared with customer)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <button className="fa-btn" data-tone="primary" disabled={saving} onClick={save}>
                    <Save size={14} />
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </section>

              {/* Timeline / Session */}
              {data.session && (
                <section className="fa-card" style={{ padding: 16 }}>
                  <div className="fa-meta">Session &amp; device</div>
                  <div className="fa-stack-sm" style={{ marginTop: 8, fontSize: 13 }}>
                    <Row label="Device" value={`${data.session.device ?? "—"} · ${data.session.browser ?? "—"} · ${data.session.os ?? "—"}`} />
                    <Row label="Geo" value={`${data.session.city ?? "—"}${data.session.region ? `, ${data.session.region}` : ""} · ${data.session.countryCode ?? "—"}`} />
                    <Row label="ISP" value={data.session.isp ?? "—"} />
                    <Row label="Quality" value={`${data.session.qualityScore}/100 · ${data.session.isValid ? "valid" : "filtered"}`} />
                    {data.session.traffic?.reason && <Row label="Flags" value={data.session.traffic.reason} />}
                    <Row label="Started" value={formatDate(data.session.startedAt)} />
                  </div>
                </section>
              )}

              {/* Meta */}
              <section className="fa-card" style={{ padding: 16, fontSize: 12.5 }}>
                <div className="fa-meta">Metadata</div>
                <div className="fa-stack-sm" style={{ marginTop: 8 }}>
                  <Row label="Created" value={formatDate(data.createdAt)} />
                  <Row label="Items" value={formatNumber(data.itemCount)} />
                  <Row label="Payment" value={data.paymentMethod.toUpperCase()} />
                  <Row label="Source path" value={data.sourcePath ?? "—"} />
                </div>
              </section>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="fa-row">
      <span className="fa-meta">{label}</span>
      <span style={{ textAlign: "right" }}>{value}</span>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="fa-row">
      <span className="fa-meta">{label}</span>
      <button
        type="button"
        className="fa-btn"
        data-tone="ghost"
        style={{ padding: "4px 8px", fontSize: 12.5 }}
        onClick={() => navigator.clipboard.writeText(value).catch(() => undefined)}
        title="Copy"
      >
        {value} <Copy size={12} />
      </button>
    </div>
  );
}
