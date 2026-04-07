"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface AllocationSlice {
  name: string;
  value: number; // 원 단위
  color: string;
}

interface AllocationDonutProps {
  data: AllocationSlice[];
}

const RADIAN = Math.PI / 180;

/** 도넛 내부 커스텀 레이블 */
function renderCustomizedLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}) {
  if ((percent ?? 0) < 0.05) return null; // 5% 미만 레이블 생략
  const _cx = cx ?? 0;
  const _cy = cy ?? 0;
  const _midAngle = midAngle ?? 0;
  const _innerRadius = innerRadius ?? 0;
  const _outerRadius = outerRadius ?? 0;
  const _percent = percent ?? 0;
  const radius = _innerRadius + (_outerRadius - _innerRadius) * 0.6;
  const x = _cx + radius * Math.cos(-_midAngle * RADIAN);
  const y = _cy + radius * Math.sin(-_midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={700}
    >
      {(_percent * 100).toFixed(0)}%
    </text>
  );
}

function formatKRW(v: number) {
  if (v >= 1_0000_0000) return `${(v / 1_0000_0000).toFixed(1)}억`;
  if (v >= 1_0000) return `${Math.round(v / 1_0000)}만`;
  return v.toLocaleString("ko-KR");
}

export default function AllocationDonut({ data }: AllocationDonutProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: { name: string; value: number; payload: AllocationSlice }[];
  }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0];
    return (
      <div className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 shadow-xl">
        <p className="text-sm font-semibold text-slate-200">{item.name}</p>
        <p className="text-lg font-bold tabular-nums text-slate-100">
          {formatKRW(item.value)}원
        </p>
        <p className="text-xs text-slate-400">
          {((item.value / total) * 100).toFixed(1)}%
        </p>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="52%"
            outerRadius="78%"
            paddingAngle={2}
            dataKey="value"
            labelLine={false}
            label={renderCustomizedLabel}
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.color}
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* 범례 */}
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 px-1">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: d.color }}
            />
            <span className="truncate text-xs text-slate-400">{d.name}</span>
            <span className="ml-auto text-xs font-semibold tabular-nums text-slate-300">
              {((d.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
