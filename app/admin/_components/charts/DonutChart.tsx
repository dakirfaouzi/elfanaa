"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

/**
 * Luxury donut chart.  Reads its palette + tooltip surface from the
 * `--fa-*` CSS variables on `.fa-admin` so it follows the active theme
 * (light cream or warm charcoal) without forking the markup.
 *
 * Same theme-observer pattern as `RevenueChart` — a MutationObserver
 * on `<html data-fa-theme>` triggers a single re-render on swap.
 */

type Slice = { label: string; value: number };

export function DonutChart({
  data,
  height = 200,
}: {
  data: Slice[];
  height?: number;
}) {
  const palette = useDonutPalette();

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="58%"
            outerRadius="88%"
            paddingAngle={1.5}
            stroke={palette.surface}
            strokeWidth={2}
            isAnimationActive
          >
            {data.map((_, i) => (
              <Cell key={i} fill={palette.slices[i % palette.slices.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: palette.surface,
              border: `1px solid ${palette.lineStrong}`,
              borderRadius: 12,
              color: palette.text,
              fontSize: 12.5,
              boxShadow: palette.shadow,
              padding: "10px 12px",
            }}
            itemStyle={{ color: palette.text }}
            labelStyle={{
              color: palette.textMuted,
              fontSize: 11,
              fontWeight: 600,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

type DonutPalette = {
  slices: string[];
  surface: string;
  lineStrong: string;
  text: string;
  textMuted: string;
  shadow: string;
};

const LIGHT_FALLBACK: DonutPalette = {
  slices: [
    "rgb(200 162 123)",
    "rgb(123 154 118)",
    "rgb(180 140 160)",
    "rgb(200 170 130)",
    "rgb(175 150 128)",
    "rgb(200 175 110)",
    "rgb(160 148 132)",
  ],
  surface: "rgb(255 253 249)",
  lineStrong: "rgb(215 200 178)",
  text: "rgb(42 33 28)",
  textMuted: "rgb(125 107 93)",
  shadow: "0 12px 28px -8px rgba(56, 40, 24, 0.18)",
};

function readPalette(): DonutPalette {
  if (typeof document === "undefined") return LIGHT_FALLBACK;
  const root = document.querySelector(".fa-admin");
  if (!root) return LIGHT_FALLBACK;
  const style = getComputedStyle(root);
  const v = (name: string) => `rgb(${style.getPropertyValue(name).trim()})`;
  return {
    slices: [
      v("--fa-chart-1"),
      v("--fa-chart-2"),
      v("--fa-chart-3"),
      v("--fa-chart-4"),
      v("--fa-chart-5"),
      v("--fa-chart-6"),
      v("--fa-chart-7"),
    ],
    surface: v("--fa-surface"),
    lineStrong: v("--fa-line-strong"),
    text: v("--fa-text"),
    textMuted: v("--fa-text-muted"),
    shadow: style.getPropertyValue("--fa-shadow-lift") || LIGHT_FALLBACK.shadow,
  };
}

function useDonutPalette(): DonutPalette {
  const [palette, setPalette] = useState<DonutPalette>(LIGHT_FALLBACK);
  useEffect(() => {
    setPalette(readPalette());
    const observer = new MutationObserver(() => setPalette(readPalette()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-fa-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return palette;
}

// Kept exported for any caller that wants to align swatches with chart
// colours.  The values are static (light) — components that need
// theme-aware swatches should read CSS vars themselves.  Used by the
// OverviewClient legend.
export const PALETTE = LIGHT_FALLBACK.slices;
