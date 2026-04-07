"use client";

interface MetricItem {
  label: string;
  value: number;     // 원 단위
  highlight?: boolean;
}

interface NetWorthHeroProps {
  netWorth: number;          // 순자산 (원)
  changeAmount: number;      // 전월 대비 변동액 (원)
  changeRate: number;        // 전월 대비 변동률 (소수, e.g. 0.023)
  metrics: MetricItem[];     // 하단 보조 지표들
}

/** 원 단위를 한국 단위(억, 만)로 축약 */
function formatKRW(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_0000_0000) {
    const eok = abs / 1_0000_0000;
    return `${sign}${eok % 1 === 0 ? eok.toFixed(0) : eok.toFixed(1)}억원`;
  }
  if (abs >= 1_0000) {
    const man = abs / 1_0000;
    return `${sign}${man % 1 === 0 ? man.toFixed(0) : man.toFixed(0)}만원`;
  }
  return `${sign}${abs.toLocaleString("ko-KR")}원`;
}

/** 전체 원화 포맷 (콤마 구분) */
function formatFull(amount: number): string {
  return amount.toLocaleString("ko-KR") + "원";
}

export default function NetWorthHero({
  netWorth,
  changeAmount,
  changeRate,
  metrics,
}: NetWorthHeroProps) {
  const isPositive = changeAmount >= 0;
  const trendColor = isPositive
    ? "text-emerald-400"
    : "text-rose-400";
  const trendBg = isPositive
    ? "bg-emerald-500/15 border-emerald-500/30"
    : "bg-rose-500/15 border-rose-500/30";
  const trendArrow = isPositive ? "▲" : "▼";

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
      <div className="px-6 pt-6 pb-4">
        {/* 레이블 */}
        <p className="mb-1 text-sm font-medium tracking-wide text-slate-400">
          현재 순자산
        </p>

        {/* 순자산 메인 숫자 */}
        <div className="flex flex-wrap items-end gap-4">
          <h2
            className={`text-4xl font-extrabold tabular-nums leading-none sm:text-5xl ${
              netWorth >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {formatKRW(netWorth)}
          </h2>

          {/* 변동 배지 */}
          <span
            className={`mb-1 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold tabular-nums ${trendBg} ${trendColor}`}
          >
            {trendArrow}{" "}
            {formatKRW(Math.abs(changeAmount))} ({isPositive ? "+" : "-"}
            {(Math.abs(changeRate) * 100).toFixed(2)}%)
          </span>
        </div>

        <p className="mt-1 text-xs text-slate-500">
          {formatFull(netWorth)} · 전월 대비
        </p>
      </div>

      {/* 구분선 */}
      <div className="border-t border-slate-700/60" />

      {/* 보조 지표 그리드 */}
      <div className="grid grid-cols-2 gap-px bg-slate-700/30 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="flex flex-col gap-1 bg-slate-800/60 px-5 py-4"
          >
            <span className="text-xs text-slate-500">{m.label}</span>
            <span
              className={`text-lg font-bold tabular-nums ${
                m.highlight
                  ? m.value >= 0
                    ? "text-emerald-400"
                    : "text-rose-400"
                  : "text-slate-200"
              }`}
            >
              {formatKRW(m.value)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
