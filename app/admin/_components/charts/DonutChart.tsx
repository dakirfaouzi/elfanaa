"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

/**
 * Luxury chart palette.  Sourced from the warm/cream brand spectrum so
 * the donut always reads as part of the editorial identity, never as a
 * generic SaaS rainbow.  Mirrored by `OverviewClient`'s local legend
 * so colours line up between donut and legend rows.
 */
const PALETTE = [
  "#C8A27B", // champagne (accent)
  "#7B9A76", // sage
  "#B48CA0", // dusty mauve
  "#C8AA82", // light champagne
  "#AF9680", // warm taupe
  "#BAAF70", // honey
  "#A09484", // warm grey
];

type Slice = { label: string; value: number };

export function DonutChart({
  data,
  height = 200,
}: {
  data: Slice[];
  height?: number;
}) {
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
            stroke="#FFFDF9"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#FFFDF9",
              border: "1px solid #D7C8B2",
              borderRadius: 12,
              color: "#2A211C",
              fontSize: 12.5,
              boxShadow: "0 12px 28px -8px rgba(56, 40, 24, 0.18)",
              padding: "10px 12px",
            }}
            itemStyle={{ color: "#2A211C" }}
            labelStyle={{
              color: "#7D6B5D",
              fontSize: 11,
              fontWeight: 600,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export { PALETTE };
