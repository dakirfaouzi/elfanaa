"use client";

import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { KpiCard } from "./_components/KpiCard";
import { formatCurrency, formatNumber, formatPercent } from "./_components/format";
import {
  adminFetcher,
  ErrorState,
  PartialDataBanner,
  extractErrors,
} from "./_components/data";

const RevenueChart = dynamic(() => import("./_components/charts/RevenueChart").then((m) => m.RevenueChart), {
  ssr: false,
  loading: () => <div className="fa-skel" style={{ height: 280, width: "100%" }} />,
});
const DonutChart = dynamic(() => import("./_components/charts/DonutChart").then((m) => m.DonutChart), {
  ssr: false,
  loading: () => <div className="fa-skel" style={{ height: 200, width: "100%" }} />,
});

type Overview = {
  overview: {
    sessions: { value: number; delta: number | null };
    visitors: { value: number; delta: number | null };
    validVisitors: { value: number; delta: number | null };
    orders: { value: number; delta: number | null };
    revenueMinor: { value: number; delta: number | null };
    aovMinor: number;
    rpvMinor: number;
    conversionRate: number;
    checkoutConversionRate: number;
    upsellRate: number;
    repeatRate: number;
    productViews: number;
    ctaClicks: number;
    addToCart: number;
    checkoutOpen: number;
    orderSubmits: number;
    upsellAccepts: number;
    crossSellAccepts: number;
  };
  trend: Array<{ day: string; sessions: number; valid: number; orders: number; revenueMinor: number }>;
  products: Array<{ productId: string; slug: string | null; title: string; revenueMinor: number; units: number; orders: number }>;
  landings: Array<{ path: string; sessions: number; orders: number; cr: number }>;
  cities: Array<{ city: string; countryCode: string | null; sessions: number }>;
  sources: Array<{ source: string; sessions: number }>;
  devices: Array<{ device: string; sessions: number }>;
};

export function OverviewClient() {
  const params = useSearchParams();
  const qs = params?.toString() ?? "";
  const { data, error, isLoading } = useSWR<Overview>(
    `/api/admin/metrics/overview?${qs}`,
    adminFetcher,
    { revalidateOnFocus: false }
  );

  if (error) return <ErrorState error={error} />;

  if (isLoading || !data) {
    return (
      <div className="fa-stack">
        <div className="fa-grid fa-grid-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="fa-skel" style={{ height: 102 }} />
          ))}
        </div>
        <div className="fa-skel" style={{ height: 320 }} />
      </div>
    );
  }

  const o = data.overview;
  const errors = extractErrors(data);

  return (
    <div className="fa-stack">
      <PartialDataBanner errors={errors} />
      {/* Headline KPI grid */}
      <div className="fa-grid fa-grid-4">
        <KpiCard label="Revenue" value={formatCurrency(o.revenueMinor.value)} delta={o.revenueMinor.delta} />
        <KpiCard label="Orders" value={formatNumber(o.orders.value)} delta={o.orders.delta} />
        <KpiCard label="AOV" value={formatCurrency(o.aovMinor)} />
        <KpiCard label="Conversion rate" value={formatPercent(o.conversionRate)} />
        <KpiCard label="Valid KSA visitors" value={formatNumber(o.validVisitors.value)} delta={o.validVisitors.delta} sub="Real human GCC traffic" />
        <KpiCard label="Sessions" value={formatNumber(o.sessions.value)} delta={o.sessions.delta} />
        <KpiCard label="Revenue per visitor" value={formatCurrency(o.rpvMinor)} />
        <KpiCard label="Checkout CR" value={formatPercent(o.checkoutConversionRate)} sub="Order / checkout opened" />
      </div>

      {/* Revenue chart */}
      <div className="fa-card fa-card-pad-lg">
        <div className="fa-section-title">
          <h2>Revenue · valid sessions</h2>
        </div>
        <RevenueChart data={data.trend} />
      </div>

      {/* Funnel preview */}
      <div className="fa-grid fa-grid-2">
        <div className="fa-card fa-card-pad-lg">
          <div className="fa-section-title">
            <h2>Behavioural funnel</h2>
            <a href={`/admin/funnel?${qs}`} className="fa-link">
              See full funnel →
            </a>
          </div>
          <div>
            <FunnelRow label="Product views" v={o.productViews} max={o.productViews} />
            <FunnelRow label="CTA clicks" v={o.ctaClicks} max={o.productViews} />
            <FunnelRow label="Add to cart" v={o.addToCart} max={o.productViews} />
            <FunnelRow label="Checkout opened" v={o.checkoutOpen} max={o.productViews} />
            <FunnelRow label="Orders" v={o.orders.value} max={o.productViews} />
          </div>
        </div>

        <div className="fa-card fa-card-pad-lg">
          <div className="fa-section-title">
            <h2>Upsell &amp; cross-sell</h2>
          </div>
          <div className="fa-grid fa-grid-2">
            <KpiCard label="Upsell rate" value={formatPercent(o.upsellRate)} sub="Accepted / viewed" />
            <KpiCard label="Upsell orders" value={formatNumber(o.upsellAccepts)} />
            <KpiCard label="Cross-sell accepts" value={formatNumber(o.crossSellAccepts)} />
            <KpiCard label="Repeat rate" value={formatPercent(o.repeatRate)} sub="Returning buyers" />
          </div>
        </div>
      </div>

      {/* Tables row */}
      <div className="fa-grid fa-grid-2">
        <div className="fa-card fa-card-pad-lg">
          <div className="fa-section-title"><h2>Top products by revenue</h2></div>
          {data.products.length === 0 ? (
            <Empty />
          ) : (
            <table className="fa-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{ textAlign: "right" }}>Units</th>
                  <th style={{ textAlign: "right" }}>Orders</th>
                  <th style={{ textAlign: "right" }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p.productId}>
                    <td>{p.title}</td>
                    <td style={{ textAlign: "right" }} className="fa-mono">{formatNumber(p.units)}</td>
                    <td style={{ textAlign: "right" }} className="fa-mono">{formatNumber(p.orders)}</td>
                    <td style={{ textAlign: "right" }} className="fa-mono">{formatCurrency(p.revenueMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="fa-card fa-card-pad-lg">
          <div className="fa-section-title"><h2>Top landing pages</h2></div>
          {data.landings.length === 0 ? (
            <Empty />
          ) : (
            <table className="fa-table">
              <thead>
                <tr>
                  <th>Path</th>
                  <th style={{ textAlign: "right" }}>Sessions</th>
                  <th style={{ textAlign: "right" }}>Orders</th>
                  <th style={{ textAlign: "right" }}>CR</th>
                </tr>
              </thead>
              <tbody>
                {data.landings.map((p) => (
                  <tr key={p.path}>
                    <td><code style={{ fontSize: 12 }}>{p.path}</code></td>
                    <td style={{ textAlign: "right" }} className="fa-mono">{formatNumber(p.sessions)}</td>
                    <td style={{ textAlign: "right" }} className="fa-mono">{formatNumber(p.orders)}</td>
                    <td style={{ textAlign: "right" }} className="fa-mono">{formatPercent(p.cr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="fa-grid fa-grid-3">
        <div className="fa-card fa-card-pad-lg">
          <div className="fa-section-title"><h2>Devices</h2></div>
          <DonutChart data={data.devices.map((d) => ({ label: d.device, value: d.sessions }))} />
          <Legend data={data.devices.map((d) => ({ label: d.device, value: d.sessions }))} />
        </div>
        <div className="fa-card fa-card-pad-lg">
          <div className="fa-section-title"><h2>Traffic sources</h2></div>
          <DonutChart data={data.sources.map((d) => ({ label: d.source, value: d.sessions }))} />
          <Legend data={data.sources.map((d) => ({ label: d.source, value: d.sessions }))} />
        </div>
        <div className="fa-card fa-card-pad-lg">
          <div className="fa-section-title"><h2>Top cities</h2></div>
          {data.cities.length === 0 ? <Empty /> : (
            <table className="fa-table">
              <thead><tr><th>City</th><th style={{ textAlign: "right" }}>Sessions</th></tr></thead>
              <tbody>
                {data.cities.map((c, i) => (
                  <tr key={i}>
                    <td>{c.city ?? "—"}</td>
                    <td style={{ textAlign: "right" }} className="fa-mono">{formatNumber(c.sessions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function FunnelRow({ label, v, max }: { label: string; v: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((v / max) * 100)) : 0;
  return (
    <div className="fa-funnel-row">
      <div style={{ color: "rgb(42 33 28)", fontSize: 13.5, fontWeight: 500 }}>{label}</div>
      <div className="fa-funnel-bar">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="fa-mono" style={{ textAlign: "right", fontWeight: 600 }}>{formatNumber(v)}</div>
      <div className="fa-mono" style={{ textAlign: "right", color: "rgb(170 152 134)" }}>{pct}%</div>
    </div>
  );
}

function Empty() {
  return (
    <div className="fa-empty">
      <strong>No data in range</strong>
      Once events arrive, this view fills automatically.
    </div>
  );
}

/**
 * Donut legend. Palette mirrors `DonutChart.PALETTE` (luxury cream/gold
 * spectrum) so colour swatches line up exactly with the chart cells.
 */
function Legend({ data }: { data: Array<{ label: string; value: number }> }) {
  const colors = [
    "#C8A27B", // champagne
    "#7B9A76", // sage
    "#B48CA0", // dusty mauve
    "#C8AA82", // light champagne
    "#AF9680", // warm taupe
    "#BAAF70", // honey
    "#A09484", // warm grey
  ];
  return (
    <div className="fa-stack-sm" style={{ marginTop: 12 }}>
      {data.map((d, i) => (
        <div key={i} className="fa-row" style={{ fontSize: 12.5 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: colors[i % colors.length],
                boxShadow: "0 0 0 2px rgb(255 253 249)",
              }}
            />
            <span style={{ color: "rgb(42 33 28)" }}>{d.label}</span>
          </span>
          <span className="fa-mono" style={{ color: "rgb(125 107 93)" }}>
            {formatNumber(d.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
