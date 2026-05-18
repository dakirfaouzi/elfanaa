"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const PALETTE = [
  "rgb(199,162,124)",
  "rgb(132,130,246)",
  "rgb(92,156,245)",
  "rgb(76,191,142)",
  "rgb(232,168,88)",
  "rgb(234,102,102)",
  "rgb(158,165,180)",
];

type Slice = { label: string; value: number };

export function DonutChart({ data, height = 200 }: { data: Slice[]; height?: number }) {
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
            paddingAngle={1}
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "rgb(17,19,23)",
              border: "1px solid rgb(56,62,73)",
              borderRadius: 10,
              color: "rgb(232,234,240)",
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export { PALETTE };
