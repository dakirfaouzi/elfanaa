import { ArrowDown, ArrowUp, Minus } from "lucide-react";

type Props = {
  label: string;
  value: string;
  delta?: number | null;
  /** When set, delta will be displayed in inverse (lower = better, e.g. drop-off). */
  inverse?: boolean;
  sub?: string;
};

/**
 * Premium KPI tile. Used in every dashboard header — copy is monospaced
 * numerals so 12,341 and 1,300 stack cleanly when scanned.
 */
export function KpiCard({ label, value, delta, inverse, sub }: Props) {
  let tone: "up" | "down" | "flat" = "flat";
  let icon: React.ReactNode = <Minus size={12} />;
  if (delta !== null && delta !== undefined && delta !== 0) {
    const positive = inverse ? delta < 0 : delta > 0;
    tone = positive ? "up" : "down";
    icon = positive ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  }
  return (
    <div className="fa-card">
      <div className="fa-kpi-label">{label}</div>
      <div className="fa-kpi-value fa-mono">{value}</div>
      {delta !== null && delta !== undefined ? (
        <div className="fa-kpi-sub">
          <span className="fa-delta" data-tone={tone}>
            {icon}
            {delta > 0 ? "+" : ""}
            {delta}%
          </span>{" "}
          vs previous period
        </div>
      ) : sub ? (
        <div className="fa-kpi-sub">{sub}</div>
      ) : null}
    </div>
  );
}
