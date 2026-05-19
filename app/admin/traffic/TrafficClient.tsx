"use client";

import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { KpiCard } from "../_components/KpiCard";
import { formatDate, formatNumber, formatPercent } from "../_components/format";
import {
  adminFetcher,
  ErrorState,
  PartialDataBanner,
  extractErrors,
} from "../_components/data";

type Sample = {
  id: string;
  ts: string;
  country: string | null;
  city: string | null;
  isp: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  score: number;
  flags: string[];
  reason: string | null;
};

type Traffic = {
  total: number;
  invalid: number;
  vpn: number;
  proxy: number;
  tor: number;
  hosting: number;
  bot: number;
  anonymous: number;
  samples: Sample[];
};

export function TrafficClient() {
  const params = useSearchParams();
  const { data, isLoading, error } = useSWR<Traffic>(
    `/api/admin/metrics/traffic?${params?.toString() ?? ""}`,
    adminFetcher
  );

  if (error) return <ErrorState error={error} />;
  if (isLoading || !data) return <div className="fa-skel" style={{ height: 360 }} />;

  const filterRate = data.total > 0 ? (data.invalid / data.total) * 100 : 0;
  const errors = extractErrors(data);

  return (
    <div className="fa-stack">
      <PartialDataBanner errors={errors} />
      <div className="fa-grid fa-grid-4">
        <KpiCard label="Total sessions" value={formatNumber(data.total)} sub="All inbound" />
        <KpiCard label="Filtered out" value={formatNumber(data.invalid)} sub={`${formatPercent(filterRate)} of inbound`} />
        <KpiCard label="VPN" value={formatNumber(data.vpn)} />
        <KpiCard label="Proxy" value={formatNumber(data.proxy)} />
        <KpiCard label="Hosting / datacenter" value={formatNumber(data.hosting)} />
        <KpiCard label="Bot UA" value={formatNumber(data.bot)} />
        <KpiCard label="Tor exit" value={formatNumber(data.tor)} />
        <KpiCard label="Anonymous" value={formatNumber(data.anonymous)} />
      </div>

      <div className="fa-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="fa-section-title" style={{ padding: "16px 18px 0" }}><h2>Recent filtered sessions</h2></div>
        {data.samples.length === 0 ? (
          <div className="fa-empty" style={{ borderRadius: 0, border: "none" }}><strong>No filtered traffic in range</strong>Means real GCC humans are landing on the storefront.</div>
        ) : (
          <table className="fa-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Geo</th>
                <th>ISP</th>
                <th>Device</th>
                <th style={{ textAlign: "right" }}>Score</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {data.samples.map((s) => (
                <tr key={s.id} style={{ cursor: "default" }}>
                  <td className="fa-mono" style={{ color: "rgb(170 152 134)" }}>{formatDate(s.ts)}</td>
                  <td>{[s.city, s.country].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{s.isp ?? "—"}</td>
                  <td>{[s.device, s.browser, s.os].filter(Boolean).join(" · ") || "—"}</td>
                  <td
                    className="fa-mono"
                    style={{
                      textAlign: "right",
                      fontWeight: 600,
                      color:
                        s.score < 30
                          ? "rgb(158 60 56)"
                          : s.score < 60
                          ? "rgb(186 130 32)"
                          : "rgb(92 122 88)",
                    }}
                  >
                    {s.score}
                  </td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {s.flags.map((f) => (
                        <span key={f} className="fa-tag" data-tone={f === "ua_bot" || f === "tor" ? "danger" : "warn"}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
