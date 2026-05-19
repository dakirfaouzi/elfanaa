"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatCompact, formatCurrency, formatDay } from "../format";

type Row = {
  day: string;
  revenueMinor: number;
  orders: number;
  sessions: number;
  valid: number;
};

/**
 * Headline area chart — revenue spine with a faint valid-sessions overlay.
 *
 * Theme handling
 * ──────────────
 * Recharts renders colours as strings, not via CSS, so we resolve the
 * active palette from `--fa-*` CSS variables on the `.fa-admin` element
 * at mount and on every theme change.  This keeps the chart consistent
 * with the rest of the admin (cream/champagne in light, charcoal/champagne
 * in dark) without forking the markup.
 *
 * Why no SSR for these? `OverviewClient` already imports the chart with
 * `next/dynamic({ ssr: false })`, so the variable lookup is safe.
 */
export function RevenueChart({ data }: { data: Row[] }) {
  const palette = useChartPalette();

  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fa-rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.accent} stopOpacity={0.42} />
              <stop offset="100%" stopColor={palette.accent} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fa-sess" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.positive} stopOpacity={0.22} />
              <stop offset="100%" stopColor={palette.positive} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={palette.line} vertical={false} strokeDasharray="2 4" />
          <XAxis
            dataKey="day"
            tickFormatter={(v) => formatDay(v)}
            tick={{ fill: palette.textDim, fontSize: 11 }}
            axisLine={{ stroke: palette.line }}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={(v) => formatCompact(Number(v) / 100)}
            tick={{ fill: palette.textDim, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => formatCompact(Number(v))}
            tick={{ fill: palette.textDim, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ stroke: palette.accentSoft, strokeWidth: 1 }}
            contentStyle={{
              background: palette.surface,
              border: `1px solid ${palette.lineStrong}`,
              borderRadius: 12,
              color: palette.text,
              fontSize: 12.5,
              boxShadow: palette.shadow,
              padding: "10px 12px",
            }}
            labelStyle={{
              color: palette.textMuted,
              fontSize: 11,
              letterSpacing: 0.06,
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 4,
            }}
            itemStyle={{ color: palette.text, padding: "2px 0" }}
            labelFormatter={(v) => formatDay(String(v))}
            formatter={(value, name) => {
              const n = Number(value ?? 0);
              if (name === "revenueMinor") return [formatCurrency(n), "Revenue"];
              if (name === "valid") return [formatCompact(n), "Valid sessions"];
              return [formatCompact(n), String(name)];
            }}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="revenueMinor"
            stroke={palette.accent}
            strokeWidth={2.25}
            fill="url(#fa-rev)"
            activeDot={{ r: 4, stroke: palette.accentDeep, strokeWidth: 1.5, fill: palette.surface }}
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="valid"
            stroke={palette.positive}
            strokeWidth={1.5}
            fill="url(#fa-sess)"
            strokeDasharray="4 3"
            activeDot={{ r: 3.5, stroke: palette.positive, strokeWidth: 1.25, fill: palette.surface }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Resolve chart colours from CSS variables on `.fa-admin` so the
 * chart always matches the active theme.  Subscribes to a tiny
 * MutationObserver on `<html data-fa-theme>` so the chart restyles
 * the moment the user clicks the theme toggle.
 * ──────────────────────────────────────────────────────────────── */

type ChartPalette = {
  accent: string;
  accentDeep: string;
  accentSoft: string;
  positive: string;
  line: string;
  lineStrong: string;
  text: string;
  textMuted: string;
  textDim: string;
  surface: string;
  shadow: string;
};

function readPalette(): ChartPalette {
  if (typeof document === "undefined") return LIGHT_FALLBACK;
  const root = document.querySelector(".fa-admin");
  if (!root) return LIGHT_FALLBACK;
  const style = getComputedStyle(root);
  const v = (name: string) => `rgb(${style.getPropertyValue(name).trim()})`;
  return {
    accent: v("--fa-accent"),
    accentDeep: v("--fa-accent-deep"),
    accentSoft: `rgb(${style.getPropertyValue("--fa-accent").trim()} / 0.45)`,
    positive: v("--fa-positive"),
    line: v("--fa-line"),
    lineStrong: v("--fa-line-strong"),
    text: v("--fa-text"),
    textMuted: v("--fa-text-muted"),
    textDim: v("--fa-text-dim"),
    surface: v("--fa-surface"),
    shadow: style.getPropertyValue("--fa-shadow-lift") || "0 12px 28px -8px rgba(56, 40, 24, 0.18)",
  };
}

const LIGHT_FALLBACK: ChartPalette = {
  accent: "rgb(200 162 123)",
  accentDeep: "rgb(165 130 95)",
  accentSoft: "rgba(200, 162, 123, 0.45)",
  positive: "rgb(92 122 88)",
  line: "rgb(232 220 203)",
  lineStrong: "rgb(215 200 178)",
  text: "rgb(42 33 28)",
  textMuted: "rgb(125 107 93)",
  textDim: "rgb(170 152 134)",
  surface: "rgb(255 253 249)",
  shadow: "0 12px 28px -8px rgba(56, 40, 24, 0.18)",
};

function useChartPalette(): ChartPalette {
  const [palette, setPalette] = useState<ChartPalette>(LIGHT_FALLBACK);

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
