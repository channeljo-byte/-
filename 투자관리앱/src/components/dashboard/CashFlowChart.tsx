"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export interface CashFlowDataPoint {
  month: string;
  income: number;    // 수입 (원)
  expense: number;   // 지출 (원, 양수 값)
  net: number;       // 수지 = income - expense
}

interface CashFlowChartProps {
  data: CashFlowDataPoint[];
}

function formatAxis(v: number) {
  if (Math.abs(v) >= 1_0000) return `${Math.round(v / 1_0000)}만`;
  return String(v);
}

function formatKRW(v: number) {
  if (Math.abs(v) >= 1_0000_0000) return `${(v / 1_0000_0000).toFixed(1)}억원`;
  if (Math.abs(v) >= 1_0000) return `${Math.round(v / 1_0000).toLocaleString("ko-KR")}만원`;
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
        <p key={p.name} className="flex items-center gap-2 text-sm">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-slate-400 text-xs">{p.name}</span>
          <span className="ml-auto font-bold tabular-nums text-slate-100">
            {formatKRW(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
};

export default function CashFlowChart({ data }: CashFlowChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={data}
        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        barCategoryGap="30%"
        barGap={2}
      >
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
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#334155" />
        <Bar dataKey="income" name="수입" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={24} />
        <Bar dataKey="expense" name="지출" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={24} />
        <Bar dataKey="net" name="수지" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
