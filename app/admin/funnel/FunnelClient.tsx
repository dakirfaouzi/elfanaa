"use client";

import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { formatNumber, formatPercent } from "../_components/format";

type Funnel = {
  stages: Array<{ stage: string; count: number; dropRate: number }>;
  upsellViews: number;
  upsellAccepts: number;
};

const STAGE_LABELS: Record<string, string> = {
  product_view: "Product viewed",
  cta_click: "CTA clicked",
  add_to_cart: "Added to cart",
  checkout_open: "Checkout opened",
  order_submit: "Order submitted",
  order_success: "Order confirmed",
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error("fetch_failed");
  return res.json();
};

export function FunnelClient() {
  const params = useSearchParams();
  const { data, isLoading, error } = useSWR<Funnel>(
    `/api/admin/metrics/funnel?${params?.toString() ?? ""}`,
    fetcher
  );

  if (error) return <div className="fa-empty"><strong>Couldn't load funnel.</strong></div>;
  if (isLoading || !data) return <div className="fa-skel" style={{ height: 380 }} />;

  const max = data.stages[0]?.count || 1;
  const upsellRate = data.upsellViews ? (data.upsellAccepts / data.upsellViews) * 100 : 0;

  return (
    <div className="fa-stack">
      <div className="fa-card fa-card-pad-lg">
        <div className="fa-section-title"><h2>Storefront funnel</h2></div>
        <div>
          {data.stages.map((s, i) => {
            const pct = max > 0 ? Math.max(2, Math.round((s.count / max) * 100)) : 0;
            return (
              <div key={s.stage} className="fa-funnel-row">
                <div style={{ fontSize: 13.5 }}>{STAGE_LABELS[s.stage] ?? s.stage}</div>
                <div className="fa-funnel-bar"><span style={{ width: `${pct}%` }} /></div>
                <div className="fa-mono" style={{ textAlign: "right" }}>{formatNumber(s.count)}</div>
                <div
                  className="fa-mono"
                  style={{
                    textAlign: "right",
                    color: i === 0 ? "rgb(110,118,132)" : s.dropRate > 50 ? "rgb(234,102,102)" : s.dropRate > 25 ? "rgb(232,168,88)" : "rgb(76,191,142)",
                  }}
                >
                  {i === 0 ? "—" : `↓ ${formatPercent(s.dropRate)}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="fa-card fa-card-pad-lg">
        <div className="fa-section-title"><h2>Post-purchase upsell</h2></div>
        <div className="fa-grid fa-grid-3">
          <div>
            <div className="fa-kpi-label">Upsell viewed</div>
            <div className="fa-kpi-value fa-mono">{formatNumber(data.upsellViews)}</div>
          </div>
          <div>
            <div className="fa-kpi-label">Upsell accepted</div>
            <div className="fa-kpi-value fa-mono">{formatNumber(data.upsellAccepts)}</div>
          </div>
          <div>
            <div className="fa-kpi-label">Acceptance rate</div>
            <div className="fa-kpi-value fa-mono">{formatPercent(upsellRate)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
