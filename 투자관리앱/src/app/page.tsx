import Card from "@/components/Card";
import NetWorthHero from "@/components/dashboard/NetWorthHero";
import NetWorthChart from "@/components/dashboard/NetWorthChart";
import AllocationDonut from "@/components/dashboard/AllocationDonut";
import CashFlowChart from "@/components/dashboard/CashFlowChart";
import RetirementSimulator from "@/components/dashboard/RetirementSimulator";
import {
  MOCK_SNAPSHOT,
  MOCK_METRICS,
  MOCK_NETWORTH_HISTORY,
  MOCK_ALLOCATION,
  MOCK_CASHFLOW,
} from "@/lib/mockDashboard";

export default function DashboardPage() {
  return (
    <>
      {/* ── Hero: 현재 순자산 ────────────────────────────────────────── */}
      <NetWorthHero
        netWorth={MOCK_SNAPSHOT.netWorth}
        changeAmount={MOCK_SNAPSHOT.changeAmount}
        changeRate={MOCK_SNAPSHOT.changeRate}
        metrics={MOCK_METRICS}
      />

      {/* ── Row 1: 순자산 추이 차트 + 자산 배분 도넛 ─────────────────── */}
      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title="순자산 변동 추이">
          <NetWorthChart data={MOCK_NETWORTH_HISTORY} />
        </Card>

        <Card title="자산 배분">
          <AllocationDonut data={MOCK_ALLOCATION} />
        </Card>
      </div>

      {/* ── Row 2: 월간 현금 흐름 + 은퇴 시뮬레이터 ──────────────────── */}
      <div className="mb-6 grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card title="월간 현금 흐름">
          <div className="mb-4 grid grid-cols-3 gap-3">
            {[
              { label: "평균 수입",   value: 4_333_000, color: "text-indigo-400"  },
              { label: "평균 지출",   value: 2_983_000, color: "text-rose-400"    },
              { label: "평균 순저축", value: 1_350_000, color: "text-emerald-400" },
            ].map((m) => (
              <div
                key={m.label}
                className="flex flex-col items-center rounded-xl border border-slate-700 bg-slate-800/60 py-3"
              >
                <span className="text-[10px] text-slate-500">{m.label}</span>
                <span className={`text-sm font-bold tabular-nums ${m.color}`}>
                  {(m.value / 10_000).toFixed(0)}만원
                </span>
              </div>
            ))}
          </div>
          <CashFlowChart data={MOCK_CASHFLOW} />
        </Card>

        <Card
          title="은퇴 시뮬레이터"
          action={
            <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300">
              Monte Carlo · Bootstrap
            </span>
          }
        >
          <RetirementSimulator currentNetWorth={MOCK_SNAPSHOT.netWorth} />
        </Card>
      </div>

      {/* ── Row 3: 자산 카테고리 요약 카드 ──────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[
          {
            title: "주식 포트폴리오",
            icon: "📈",
            value: "2억 1,500만원",
            change: "+3.2%",
            positive: true,
            badge: "15종목",
          },
          {
            title: "암호화폐",
            icon: "⛓",
            value: "4,500만원",
            change: "-1.8%",
            positive: false,
            badge: "5종목",
          },
          {
            title: "예금/현금",
            icon: "🏦",
            value: "1억 3,000만원",
            change: "+0.3%",
            positive: true,
            badge: "3계좌",
          },
        ].map((item) => (
          <Card key={item.title}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <p className="text-sm font-medium text-slate-400">{item.title}</p>
                  <p className="text-xl font-bold tabular-nums text-slate-100">
                    {item.value}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] text-slate-400">
                  {item.badge}
                </span>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    item.positive ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {item.change}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
