"use client";

import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { formatNumber } from "../_components/format";
import {
  adminFetcher,
  ErrorState,
  PartialDataBanner,
  extractErrors,
} from "../_components/data";

type Geo = {
  cities: Array<{ country: string | null; region: string | null; city: string | null; sessions: number }>;
  isps: Array<{ isp: string | null; sessions: number }>;
  browsers: Array<{ browser: string; sessions: number }>;
  oses: Array<{ os: string; sessions: number }>;
};

export function GeoClient() {
  const params = useSearchParams();
  const { data, isLoading, error } = useSWR<Geo>(
    `/api/admin/metrics/geo?${params?.toString() ?? ""}`,
    adminFetcher
  );

  if (error) return <ErrorState error={error} />;
  if (isLoading || !data) return <div className="fa-skel" style={{ height: 400 }} />;

  const errors = extractErrors(data);

  return (
    <div className="fa-stack">
      <PartialDataBanner errors={errors} />
      <div className="fa-grid fa-grid-2">
      <div className="fa-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="fa-section-title" style={{ padding: "16px 18px 0" }}><h2>Cities</h2></div>
        <List rows={data.cities.map((c) => ({ label: `${c.city ?? "—"}${c.region ? ` · ${c.region}` : ""}`, sub: c.country ?? "", value: c.sessions }))} />
      </div>
      <div className="fa-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="fa-section-title" style={{ padding: "16px 18px 0" }}><h2>ISP &amp; carrier</h2></div>
        <List rows={data.isps.map((c) => ({ label: c.isp ?? "—", sub: "", value: c.sessions }))} />
      </div>
      <div className="fa-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="fa-section-title" style={{ padding: "16px 18px 0" }}><h2>Browsers</h2></div>
        <List rows={data.browsers.map((c) => ({ label: c.browser, sub: "", value: c.sessions }))} />
      </div>
      <div className="fa-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="fa-section-title" style={{ padding: "16px 18px 0" }}><h2>Operating systems</h2></div>
        <List rows={data.oses.map((c) => ({ label: c.os, sub: "", value: c.sessions }))} />
      </div>
      </div>
    </div>
  );
}

function List({ rows }: { rows: Array<{ label: string; sub: string; value: number }> }) {
  if (rows.length === 0) return <div className="fa-empty" style={{ borderRadius: 0, border: "none" }}><strong>No sessions yet</strong>Filtered to valid GCC traffic.</div>;
  return (
    <table className="fa-table">
      <thead><tr><th>Label</th><th style={{ textAlign: "right" }}>Sessions</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ cursor: "default" }}>
            <td>
              <div>{r.label}</div>
              {r.sub && <code style={{ fontSize: 11, color: "rgb(110,118,132)" }}>{r.sub}</code>}
            </td>
            <td className="fa-mono" style={{ textAlign: "right" }}>{formatNumber(r.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
