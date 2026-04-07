"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Slider from "@/components/ui/Slider";
import {
  runMonteCarlo,
  RETURN_PRESETS,
  interpretSurvivalProbability,
} from "@/lib/simulation";

// ─── 상수 ────────────────────────────────────────────────────────────────
const CURRENT_AGE = 35;    // 현재 나이 (시연용 고정값)
const NUM_SIMS    = 600;   // 몬테카를로 반복 횟수 (UI 반응성 우선)

// ─── 포맷 헬퍼 ───────────────────────────────────────────────────────────
function fmtEok(v: number) {
  if (v >= 1_0000_0000) return `${(v / 1_0000_0000).toFixed(1)}억`;
  if (v >= 1_0000) return `${Math.round(v / 1_0000)}만`;
  return v.toLocaleString("ko-KR");
}

function fmtAxis(v: number) {
  if (v >= 1_0000_0000) return `${(v / 1_0000_0000).toFixed(0)}억`;
  if (v >= 1_0000) return `${Math.round(v / 1_0000)}만`;
  return String(v);
}

// ─── 생존 확률 색상 (0~100 기준) ─────────────────────────────────────────
function survivalColor(prob: number): string {
  if (prob >= 95) return "text-emerald-400";
  if (prob >= 85) return "text-green-400";
  if (prob >= 75) return "text-yellow-400";
  if (prob >= 60) return "text-orange-400";
  return "text-rose-400";
}

// ─── 차트 툴팁 ───────────────────────────────────────────────────────────
interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

const FanTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
}) => {
  if (!active || !payload?.length) return null;
  const p50 = payload.find((p) => p.name === "중앙값");
  return (
    <div className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 shadow-xl">
      <p className="mb-1 text-xs text-slate-400">{label}세</p>
      {p50 && (
        <p className="text-base font-bold tabular-nums text-emerald-400">
          {fmtEok(p50.value)}원
        </p>
      )}
    </div>
  );
};

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────
export default function RetirementSimulator({
  currentNetWorth = 100_000_000,
  annualDividendIncome = 0,
}: {
  currentNetWorth?: number;
  annualDividendIncome?: number;
}) {
  const [retireAge,      setRetireAge]      = useState(60);
  const [monthlySaving,  setMonthlySaving]  = useState(100);   // 만원
  const [returnPreset,   setReturnPreset]   = useState<"SP500_FULL" | "GLOBAL_60_40" | "CONSERVATIVE">("GLOBAL_60_40");
  const [withdrawalRate, setWithdrawalRate] = useState(4);     // %

  const PRESET_LABELS: Record<string, string> = {
    SP500_FULL:   "공격 (S&P500)",
    GLOBAL_60_40: "균형 (60/40)",
    CONSERVATIVE: "안정 (채권)",
  };

  // ── 몬테카를로 계산 ────────────────────────────────────────────────────
  const result = useMemo(() => {
    const accumulationYears = Math.max(1, retireAge - CURRENT_AGE);
    const retirementYears   = Math.max(1, 100 - retireAge);
    const savingContribution = monthlySaving * 10_000 * 12;
    const annualContribution = savingContribution + annualDividendIncome;

    const pool = RETURN_PRESETS[returnPreset] as number[];

    return runMonteCarlo({
      initialBalance:       currentNetWorth,
      annualContribution,
      accumulationYears,
      retirementYears,
      initialWithdrawalRate: withdrawalRate / 100,
      withdrawalStrategy:   "CONSTANT_DOLLAR",
      inflationRate:        0.025,
      historicalReturns:    pool,
      numSimulations:       NUM_SIMS,
      samplingMethod:       "BOOTSTRAP",
      seed:                 42,
    });
  }, [retireAge, monthlySaving, returnPreset, withdrawalRate, currentNetWorth, annualDividendIncome]);

  // ── 차트 데이터 변환 ──────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const { p5, p25, p50, p75, p95 } = result.percentileTrajectories;
    const len = p50.length;
    const items: {
      age: number;
      p5: number;
      p25: number;
      p50: number;
      p75: number;
      p95: number;
    }[] = [];
    for (let i = 0; i < len; i++) {
      items.push({
        age: CURRENT_AGE + i,
        p5:  p5[i],
        p25: p25[i],
        p50: p50[i],
        p75: p75[i],
        p95: p95[i],
      });
    }
    return items;
  }, [result]);

  // ── 집계 ──────────────────────────────────────────────────────────────
  const { survivalProbability } = result;           // 0~100
  const interp = interpretSurvivalProbability(survivalProbability);
  const sColor = survivalColor(survivalProbability);

  const accYears = Math.max(1, retireAge - CURRENT_AGE);
  const p50AtRetirement = result.percentileTrajectories.p50[accYears] ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {/* ── 슬라이더 패널 ─────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider
          label="은퇴 나이"
          value={retireAge}
          min={45}
          max={75}
          step={1}
          format={(v) => `${v}세`}
          onChange={setRetireAge}
        />
        <Slider
          label="월 저축액"
          value={monthlySaving}
          min={10}
          max={500}
          step={10}
          format={(v) => `${v}만원`}
          onChange={setMonthlySaving}
        />
        <Slider
          label="초기 인출률 (4% 룰)"
          value={withdrawalRate}
          min={2}
          max={8}
          step={0.5}
          format={(v) => `${v}%`}
          onChange={setWithdrawalRate}
        />

        {/* 포트폴리오 프리셋 토글 */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-slate-400">포트폴리오 유형</span>
          <div className="flex gap-1.5">
            {(["SP500_FULL", "GLOBAL_60_40", "CONSERVATIVE"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setReturnPreset(k)}
                className={`flex-1 rounded-lg border px-1.5 py-1.5 text-[11px] font-semibold transition-colors ${
                  returnPreset === k
                    ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                    : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600"
                }`}
              >
                {PRESET_LABELS[k]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI 요약 ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-800/60 py-3 px-2">
          <span className="text-[10px] text-slate-500">생존 확률</span>
          <span className={`text-2xl font-extrabold tabular-nums ${sColor}`}>
            {survivalProbability.toFixed(0)}%
          </span>
          <span className={`text-[10px] font-medium ${sColor}`}>{interp.label}</span>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-800/60 py-3 px-2">
          <span className="text-[10px] text-slate-500">은퇴 시 자산 (p50)</span>
          <span className="text-xl font-extrabold tabular-nums text-slate-100">
            {fmtEok(p50AtRetirement)}원
          </span>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-800/60 py-3 px-2">
          <span className="text-[10px] text-slate-500">최종 잔고 (p50)</span>
          <span className="text-xl font-extrabold tabular-nums text-emerald-400">
            {fmtEok(result.finalBalanceDistribution.median)}원
          </span>
        </div>
      </div>

      {/* ── 퍼센타일 팬 차트 ──────────────────────────────────────────── */}
      <div>
        <p className="mb-1 text-[11px] text-slate-500">
          예상 자산 분포 ({NUM_SIMS}회 시뮬레이션 · Bootstrap 샘플링)
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradP95" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="gradP75" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="gradP50" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="age"
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}세`}
            />
            <YAxis
              tickFormatter={fmtAxis}
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip content={<FanTooltip />} />

            {/* 상위 95% — 넓은 팬 */}
            <Area
              type="monotone"
              dataKey="p95"
              name="상위5%"
              stroke="none"
              fill="url(#gradP95)"
              fillOpacity={1}
            />
            {/* 상위 75% — 중간 팬 */}
            <Area
              type="monotone"
              dataKey="p75"
              name="75th"
              stroke="none"
              fill="url(#gradP75)"
              fillOpacity={1}
            />
            {/* 중앙값 라인 */}
            <Area
              type="monotone"
              dataKey="p50"
              name="중앙값"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#gradP50)"
              fillOpacity={1}
              dot={false}
            />
            {/* 하위 5% — 경고 라인 */}
            <Area
              type="monotone"
              dataKey="p5"
              name="하위5%"
              stroke="#f43f5e"
              strokeWidth={1}
              strokeDasharray="4 3"
              fill="none"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* 범례 */}
        <div className="mt-1 flex flex-wrap gap-3 px-1">
          {[
            { style: { height: 2, width: 16, background: "#10b981" },    label: "중앙값 (p50)" },
            { style: { height: 10, width: 16, background: "#6366f1", opacity: 0.5 }, label: "25th~95th" },
            { style: { height: 2, width: 16, background: "#f43f5e", borderTop: "2px dashed #f43f5e" }, label: "하위 5%" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="inline-block rounded-sm" style={l.style} />
              <span className="text-[10px] text-slate-500">{l.label}</span>
            </div>
          ))}
        </div>

        {/* 권고 메시지 */}
        <p className={`mt-2 rounded-lg border px-3 py-1.5 text-[11px] ${
          survivalProbability >= 85
            ? "border-emerald-800/40 bg-emerald-900/20 text-emerald-300"
            : survivalProbability >= 75
            ? "border-yellow-800/40 bg-yellow-900/20 text-yellow-300"
            : "border-rose-800/40 bg-rose-900/20 text-rose-300"
        }`}>
          {interp.recommendation}
        </p>

        {/* 배당금 반영 안내 */}
        {annualDividendIncome > 0 && (
          <p className="mt-2 text-[10px] text-slate-500">
            현재 연간 배당금 {fmtEok(annualDividendIncome)}원이 시뮬레이션의 복리 재투자에 반영되었습니다.
          </p>
        )}
      </div>
    </div>
  );
}
