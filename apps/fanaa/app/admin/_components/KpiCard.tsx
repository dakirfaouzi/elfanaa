import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  label: string;
  value: string;
  delta?: number | null;
  /** When set, delta is displayed inverted (lower = better, e.g. drop-off). */
  inverse?: boolean;
  sub?: string;
  /** Optional leading icon (luxury accent treatment). */
  icon?: ReactNode;
};

/**
 * Premium KPI tile.
 *
 * Visual contract:
 *   • Label is small uppercase eyebrow (luxury editorial cue).
 *   • Value is serif tabular-num so 12,341 / 1,300 / 99,000 stack
 *     cleanly when scanned vertically across a 4-up KPI grid.
 *   • Delta sits below the value with a tone-aware capsule
 *     (sage = up, rose = down, neutral = flat).
 *   • Optional leading icon paints inside an `.fa-empty-icon`-style
 *     accent square so revenue / orders tiles can be visually
 *     prioritised in a glance without breaking the grid rhythm.
 *
 * Inherits all colours from `--fa-*` CSS variables so a theme swap
 * (light/dark) flows through automatically.
 */
export function KpiCard({ label, value, delta, inverse, sub, icon }: Props) {
  let tone: "up" | "down" | "flat" = "flat";
  let arrow: ReactNode = <Minus size={12} />;
  if (delta !== null && delta !== undefined && delta !== 0) {
    const positive = inverse ? delta < 0 : delta > 0;
    tone = positive ? "up" : "down";
    arrow = positive ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  }

  return (
    <div className="fa-card fa-card-hover">
      {icon ? (
        <div
          className="fa-empty-icon"
          style={{
            margin: "0 0 12px",
            width: 36,
            height: 36,
            borderRadius: 10,
          }}
        >
          {icon}
        </div>
      ) : null}

      <div className="fa-kpi-label">{label}</div>
      <div className="fa-kpi-value fa-mono">{value}</div>

      {delta !== null && delta !== undefined ? (
        <div className="fa-kpi-sub">
          <span className="fa-delta" data-tone={tone}>
            {arrow}
            {delta > 0 ? "+" : ""}
            {delta}%
          </span>
          <span>vs previous period</span>
        </div>
      ) : sub ? (
        <div className="fa-kpi-sub">{sub}</div>
      ) : null}
    </div>
  );
}
