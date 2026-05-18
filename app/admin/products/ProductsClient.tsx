"use client";

import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { formatCurrency, formatNumber, formatPercent } from "../_components/format";

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

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error("fetch_failed");
  return res.json();
};

export function ProductsClient() {
  const params = useSearchParams();
  const { data, isLoading, error } = useSWR<Row[]>(
    `/api/admin/metrics/products?${params?.toString() ?? ""}`,
    fetcher
  );

  if (error) return <div className="fa-empty"><strong>Couldn't load product metrics.</strong></div>;
  if (isLoading || !data) return <div className="fa-skel" style={{ height: 400 }} />;

  return (
    <div className="fa-card" style={{ padding: 0, overflow: "hidden" }}>
      {data.length === 0 ? (
        <div className="fa-empty"><strong>No product data yet</strong>Track product_view + cta_click events to populate.</div>
      ) : (
        <table className="fa-table">
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
            {data.map((r) => (
              <tr key={r.productId} style={{ cursor: "default" }}>
                <td>
                  <div>{r.slug ?? r.productId}</div>
                  <code style={{ fontSize: 11, color: "rgb(110,118,132)" }}>{r.productId}</code>
                </td>
                <td className="fa-mono" style={{ textAlign: "right" }}>{formatNumber(r.views)}</td>
                <td className="fa-mono" style={{ textAlign: "right" }}>{formatNumber(r.ctaClicks)}</td>
                <td className="fa-mono" style={{ textAlign: "right" }}>{formatPercent(r.ctr)}</td>
                <td className="fa-mono" style={{ textAlign: "right" }}>{formatNumber(r.addToCarts)}</td>
                <td className="fa-mono" style={{ textAlign: "right" }}>{formatNumber(r.orders)}</td>
                <td className="fa-mono" style={{ textAlign: "right" }}>{formatPercent(r.conversionRate)}</td>
                <td className="fa-mono" style={{ textAlign: "right" }}>{formatCurrency(r.aovMinor)}</td>
                <td className="fa-mono" style={{ textAlign: "right" }}>{formatCurrency(r.revenueMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
