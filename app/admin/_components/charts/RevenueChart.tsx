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
 * Visual identity matches the admin's cream + champagne palette
 * (`--fa-accent`, `--fa-positive`) rather than generic SaaS blue/purple.
 * The two-metric overlay lets the operator read a revenue spike against
 * traffic: revenue rising on flat sessions = winning ad creative;
 * revenue rising in lockstep with sessions = scaling spend.
 *
 * All colours are inlined hex so Recharts can render server-side without
 * needing the CSS-var tree at first paint. They mirror the tokens in
 * `app/admin/admin.css`:
 *   • Revenue line  = #C8A27B (rose-gold, `--fa-accent`)
 *   • Sessions line = #7B9A76 (sage,      `--fa-positive`)
 *   • Grid          = #E8DCCB (line,      `--fa-line`)
 *   • Tooltip       = #FFFDF9 surface     (`--fa-surface`)
 */
export function RevenueChart({ data }: { data: Row[] }) {
  const TICK = { fill: "#AA9886", fontSize: 11 } as const;

  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fa-rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C8A27B" stopOpacity={0.42} />
              <stop offset="100%" stopColor="#C8A27B" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fa-sess" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7B9A76" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#7B9A76" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E8DCCB" vertical={false} strokeDasharray="2 4" />
          <XAxis
            dataKey="day"
            tickFormatter={(v) => formatDay(v)}
            tick={TICK}
            axisLine={{ stroke: "#E8DCCB" }}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={(v) => formatCompact(Number(v) / 100)}
            tick={TICK}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => formatCompact(Number(v))}
            tick={TICK}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ stroke: "rgba(200, 162, 123, 0.45)", strokeWidth: 1 }}
            contentStyle={{
              background: "#FFFDF9",
              border: "1px solid #D7C8B2",
              borderRadius: 12,
              color: "#2A211C",
              fontSize: 12.5,
              boxShadow: "0 12px 28px -8px rgba(56, 40, 24, 0.18)",
              padding: "10px 12px",
            }}
            labelStyle={{
              color: "#7D6B5D",
              fontSize: 11,
              letterSpacing: 0.06,
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 4,
            }}
            itemStyle={{ color: "#2A211C", padding: "2px 0" }}
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
            stroke="#C8A27B"
            strokeWidth={2.25}
            fill="url(#fa-rev)"
            activeDot={{ r: 4, stroke: "#A5825F", strokeWidth: 1.5, fill: "#FFFDF9" }}
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="valid"
            stroke="#7B9A76"
            strokeWidth={1.5}
            fill="url(#fa-sess)"
            strokeDasharray="4 3"
            activeDot={{ r: 3.5, stroke: "#5C7A58", strokeWidth: 1.25, fill: "#FFFDF9" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
