"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface NetWorthDataPoint {
  month: string;   // "2024.01" 형태
  netWorth: number;
  assets: number;
  liabilities: number;
}

interface NetWorthChartProps {
  data: NetWorthDataPoint[];
}

function formatAxis(v: number) {
  if (v >= 1_0000_0000) return `${(v / 1_0000_0000).toFixed(0)}억`;
  if (v >= 1_0000) return `${Math.round(v / 1_0000)}만`;
  return String(v);
}

function formatKRW(v: number) {
  if (v >= 1_0000_0000) return `${(v / 1_0000_0000).toFixed(2)}억원`;
  if (v >= 1_0000) return `${Math.round(v / 1_0000).toLocaleString("ko-KR")}만원`;
  return `${v.toLocaleString("ko-KR")}원`;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 shadow-xl">
      <p className="mb-2 text-xs font-medium text-slate-400">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-sm font-bold tabular-nums">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400 font-normal">{p.name}</span>
          <span className="text-slate-100">{formatKRW(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

export default function NetWorthChart({ data }: NetWorthChartProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradAssets" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradNetWorth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradLiab" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatAxis}
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="assets"
          name="총자산"
          stroke="#6366f1"
          strokeWidth={1.5}
          fill="url(#gradAssets)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="liabilities"
          name="부채"
          stroke="#f43f5e"
          strokeWidth={1.5}
          fill="url(#gradLiab)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="netWorth"
          name="순자산"
          stroke="#10b981"
          strokeWidth={2.5}
          fill="url(#gradNetWorth)"
          dot={false}
          strokeDasharray={undefined}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
