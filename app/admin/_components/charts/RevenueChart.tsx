"use client";

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

type Row = { day: string; revenueMinor: number; orders: number; sessions: number; valid: number };

/**
 * Headline area chart — revenue spine with a faint sessions overlay.
 *
 * Why two stacked metrics? It gives the operator a quick read on whether
 * a revenue spike is volume-driven (sessions up) or efficiency-driven
 * (revenue rising on flat traffic — usually a winning ad creative).
 */
export function RevenueChart({ data }: { data: Row[] }) {
  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fa-rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(199,162,124)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="rgb(199,162,124)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fa-sess" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(132,130,246)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="rgb(132,130,246)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgb(28,32,38)" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={(v) => formatDay(v)}
            tick={{ fill: "rgb(110,118,132)", fontSize: 11 }}
            axisLine={{ stroke: "rgb(28,32,38)" }}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={(v) => formatCompact(Number(v) / 100)}
            tick={{ fill: "rgb(110,118,132)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => formatCompact(Number(v))}
            tick={{ fill: "rgb(110,118,132)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ stroke: "rgba(199,162,124,0.35)", strokeWidth: 1 }}
            contentStyle={{
              background: "rgb(17,19,23)",
              border: "1px solid rgb(56,62,73)",
              borderRadius: 10,
              color: "rgb(232,234,240)",
              fontSize: 12,
            }}
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
            stroke="rgb(199,162,124)"
            strokeWidth={2}
            fill="url(#fa-rev)"
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="valid"
            stroke="rgb(132,130,246)"
            strokeWidth={1.5}
            fill="url(#fa-sess)"
            strokeDasharray="4 3"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
