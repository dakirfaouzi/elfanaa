"use client";

import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { formatCurrency, formatNumber, formatPercent } from "../_components/format";
import {
  adminFetcher,
  ErrorState,
  PartialDataBanner,
  extractErrors,
} from "../_components/data";

type Row = {
  productId: string;
  slug: string | null;
  views: number;
  ctaClicks: number;
  addToCarts: number;
  orders: number;
  units: number;
  revenueMinor: number;
  ctr: number;
  conversionRate: number;
  aovMinor: number;
};

type Payload = { rows: Row[]; _errors?: Array<{ label: string; error: string }> };

export function ProductsClient() {
  const params = useSearchParams();
  const { data, isLoading, error } = useSWR<Payload>(
    `/api/admin/metrics/products?${params?.toString() ?? ""}`,
    adminFetcher
  );

  if (error) return <ErrorState error={error} />;
  if (isLoading || !data) return <div className="fa-skel" style={{ height: 400 }} />;

  const rows = data.rows ?? [];
  const errors = extractErrors(data);

  return (
    <div className="fa-stack">
      <PartialDataBanner errors={errors} />
      <div className="fa-card" style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <div className="fa-empty">
            <strong>No product data yet</strong>
            Track product_view + cta_click events to populate.
          </div>
        ) : (
          <div className="fa-table-wrap">
            <table className="fa-table fa-table-stack">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{ textAlign: "right" }}>Views</th>
                  <th style={{ textAlign: "right" }}>CTA clicks</th>
                  <th style={{ textAlign: "right" }}>CTR</th>
                  <th style={{ textAlign: "right" }}>Add to cart</th>
                  <th style={{ textAlign: "right" }}>Orders</th>
                  <th style={{ textAlign: "right" }}>CR</th>
                  <th style={{ textAlign: "right" }}>AOV</th>
                  <th style={{ textAlign: "right" }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.productId} style={{ cursor: "default" }} className="fa-row-static">
                    <td data-label="Product">
                      <div>{r.slug ?? r.productId}</div>
                      <code style={{ fontSize: 11, color: "rgb(170 152 134)" }}>{r.productId}</code>
                    </td>
                    <td data-label="Views" data-align="right" className="fa-mono" style={{ textAlign: "right" }}>{formatNumber(r.views)}</td>
                    <td data-label="CTA clicks" data-align="right" className="fa-mono" style={{ textAlign: "right" }}>{formatNumber(r.ctaClicks)}</td>
                    <td data-label="CTR" data-align="right" className="fa-mono" style={{ textAlign: "right" }}>{formatPercent(r.ctr)}</td>
                    <td data-label="Add to cart" data-align="right" className="fa-mono" style={{ textAlign: "right" }}>{formatNumber(r.addToCarts)}</td>
                    <td data-label="Orders" data-align="right" className="fa-mono" style={{ textAlign: "right" }}>{formatNumber(r.orders)}</td>
                    <td data-label="CR" data-align="right" className="fa-mono" style={{ textAlign: "right" }}>{formatPercent(r.conversionRate)}</td>
                    <td data-label="AOV" data-align="right" className="fa-mono" style={{ textAlign: "right" }}>{formatCurrency(r.aovMinor)}</td>
                    <td data-label="Revenue" data-align="right" className="fa-mono" style={{ textAlign: "right", fontWeight: 600 }}>{formatCurrency(r.revenueMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
