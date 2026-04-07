"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Card from "@/components/Card";
import NetWorthHero from "@/components/dashboard/NetWorthHero";
import NetWorthChart from "@/components/dashboard/NetWorthChart";
import AllocationDonut from "@/components/dashboard/AllocationDonut";
import CashFlowChart from "@/components/dashboard/CashFlowChart";
import RetirementSimulator from "@/components/dashboard/RetirementSimulator";

// ─── 타입 ───
interface Asset {
  _id: string;
  name: string;
  assetType: string;
  currency: string;
  quantity: number | string;
  avgPrice: number | string;
  currentPrice: number | string;
  investedValue: number;
  currentValue: number;
  dividendYield?: number;
  dividendFrequency?: string;
  isActive: boolean;
}

interface Liability {
  _id: string;
  name: string;
  remainingBalance: number | string;
  currency: string;
  isActive: boolean;
}

interface Transaction {
  _id: string;
  transactionType: string;
  totalAmount: number | string;
  date: string;
  category?: string;
}

interface Snapshot {
  _id: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  date: string;
}

// ─── 상수 ───
const ASSET_TYPE_LABELS: Record<string, string> = {
  STOCK_KR: "국내 주식",
  STOCK_US: "미국 주식/ETF",
  CRYPTO: "암호화폐",
  CASH: "예금/현금",
  BOND: "채권",
  FUND: "펀드",
  REAL_ESTATE: "부동산",
  GOLD: "금",
  OTHER: "기타",
};

const ASSET_TYPE_COLORS: Record<string, string> = {
  STOCK_KR: "#6366f1",
  STOCK_US: "#8b5cf6",
  CRYPTO: "#f59e0b",
  CASH: "#10b981",
  BOND: "#06b6d4",
  FUND: "#ec4899",
  REAL_ESTATE: "#f97316",
  GOLD: "#eab308",
  OTHER: "#94a3b8",
};

// ─── 유틸 ───
function n(v: number | string | undefined | null): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v) || 0;
}

function toKRW(value: number, currency: string, rate: number) {
  if (currency === "USD") return value * rate;
  return value;
}

function formatKRW(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_0000_0000) {
    const v = abs / 1_0000_0000;
    return `${sign}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}억원`;
  }
  if (abs >= 1_0000) {
    return `${sign}${Math.round(abs / 1_0000).toLocaleString("ko-KR")}만원`;
  }
  return `${sign}${Math.round(abs).toLocaleString("ko-KR")}원`;
}

// ─── 컴포넌트 ───
export default function DashboardPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchangeRate, setExchangeRate] = useState(1370);

  // localStorage에서 환율 읽기 (hydration-safe)
  useEffect(() => {
    const saved = localStorage.getItem("usdkrw");
    if (saved) {
      const v = Number(saved);
      if (v > 0) setExchangeRate(v);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [aRes, lRes, tRes, sRes] = await Promise.all([
        fetch("/api/assets?active=true"),
        fetch("/api/liabilities?active=true"),
        fetch("/api/transactions?limit=1000"),
        fetch("/api/snapshots"),
      ]);
      const aData = await aRes.json();
      const lData = await lRes.json();
      const tData = await tRes.json();
      const sData = await sRes.json();

      setAssets(Array.isArray(aData) ? aData : []);
      setLiabilities(Array.isArray(lData) ? lData : []);
      setTransactions(Array.isArray(tData?.items) ? tData.items : Array.isArray(tData) ? tData : []);
      setSnapshots(Array.isArray(sData) ? sData : []);
    } catch {
      /* API 연결 실패 시 빈 배열 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── 총자산 / 총부채 / 순자산 ──
  const totalAssets = useMemo(() => {
    return assets.reduce((sum, a) => {
      const val = n(a.currentValue) || n(a.quantity) * n(a.currentPrice);
      return sum + toKRW(val, a.currency, exchangeRate);
    }, 0);
  }, [assets, exchangeRate]);

  const totalDebt = useMemo(() => {
    return liabilities.reduce((sum, l) => sum + toKRW(n(l.remainingBalance), l.currency, exchangeRate), 0);
  }, [liabilities, exchangeRate]);

  const netWorth = totalAssets - totalDebt;

  // ── 전월 대비 (스냅샷 기반, 없으면 0) ──
  const prevSnapshot = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : snapshots.length === 1 ? snapshots[0] : null;
  const changeAmount = prevSnapshot ? netWorth - prevSnapshot.netWorth : 0;
  const changeRate = prevSnapshot && prevSnapshot.netWorth !== 0 ? changeAmount / Math.abs(prevSnapshot.netWorth) : 0;

  // ── 이달 수입/지출 ──
  const today = useMemo(() => new Date(), []);
  const thisMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const { monthIncome, monthExpense } = useMemo(() => {
    let income = 0, expense = 0;
    transactions.forEach((t) => {
      if (!t.date?.startsWith(thisMonthKey)) return;
      const amt = n(t.totalAmount);
      if (t.transactionType === "DEPOSIT" || t.transactionType === "INTEREST" || t.transactionType === "DIVIDEND") {
        income += amt;
      } else if (t.transactionType === "WITHDRAWAL" || t.transactionType === "FEE") {
        expense += amt;
      }
    });
    return { monthIncome: income, monthExpense: expense };
  }, [transactions, thisMonthKey]);

  // ── Hero 보조 지표 ──
  const metrics = [
    { label: "총자산", value: totalAssets, highlight: false },
    { label: "총부채", value: -totalDebt, highlight: true },
    { label: "이달 수입", value: monthIncome, highlight: false },
    { label: "이달 지출", value: -monthExpense, highlight: true },
    { label: "이달 순저축", value: monthIncome - monthExpense, highlight: true },
  ];

  // ── 순자산 추이 (스냅샷 + 현재 실시간) ──
  const networthHistory = useMemo(() => {
    const history = snapshots.map((s) => ({
      month: s.date?.slice(0, 7).replace("-", ".") || "",
      assets: s.totalAssets || 0,
      liabilities: s.totalLiabilities || 0,
      netWorth: s.netWorth || 0,
    }));

    // 현재 시점 데이터 포인트 추가
    const nowLabel = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}`;
    const lastMonth = history.length > 0 ? history[history.length - 1].month : "";

    if (lastMonth !== nowLabel) {
      history.push({
        month: nowLabel,
        assets: totalAssets,
        liabilities: totalDebt,
        netWorth,
      });
    } else {
      // 같은 월이면 현재 값으로 업데이트
      history[history.length - 1] = {
        month: nowLabel,
        assets: totalAssets,
        liabilities: totalDebt,
        netWorth,
      };
    }

    return history;
  }, [snapshots, totalAssets, totalDebt, netWorth, today]);

  // ── 자산 배분 ──
  const allocation = useMemo(() => {
    const map: Record<string, number> = {};
    assets.forEach((a) => {
      const val = n(a.currentValue) || n(a.quantity) * n(a.currentPrice);
      const krw = toKRW(val, a.currency, exchangeRate);
      const type = a.assetType || "OTHER";
      map[type] = (map[type] || 0) + krw;
    });
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([type, value]) => ({
        name: ASSET_TYPE_LABELS[type] || type,
        value,
        color: ASSET_TYPE_COLORS[type] || "#94a3b8",
      }))
      .sort((a, b) => b.value - a.value);
  }, [assets, exchangeRate]);

  // ── 연간 배당금 합계 ──
  const annualDividendIncome = useMemo(() => {
    return assets.reduce((sum, a) => {
      const yieldPct = a.dividendYield ?? 0;
      const freq = a.dividendFrequency ?? "NONE";
      if (yieldPct <= 0 || freq === "NONE") return sum;
      const val = n(a.currentValue) || n(a.quantity) * n(a.currentPrice);
      const krw = toKRW(val, a.currency, exchangeRate);
      return sum + krw * (yieldPct / 100);
    }, 0);
  }, [assets, exchangeRate]);

  // ── 월간 현금 흐름 (최근 6개월) ──
  const cashflowData = useMemo(() => {
    const months: { month: string; income: number; expense: number; net: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${d.getMonth() + 1}월`;
      let income = 0, expense = 0;
      transactions.forEach((t) => {
        if (!t.date?.startsWith(key)) return;
        const amt = n(t.totalAmount);
        if (t.transactionType === "DEPOSIT" || t.transactionType === "INTEREST" || t.transactionType === "DIVIDEND") {
          income += amt;
        } else if (t.transactionType === "WITHDRAWAL" || t.transactionType === "FEE") {
          expense += amt;
        }
      });
      months.push({ month: label, income, expense, net: income - expense });
    }
    return months;
  }, [transactions, today]);

  // ── 자산 카테고리 요약 ──
  const categorySummary = useMemo(() => {
    const map: Record<string, { value: number; invested: number; count: number }> = {};
    assets.forEach((a) => {
      const type = a.assetType || "OTHER";
      if (!map[type]) map[type] = { value: 0, invested: 0, count: 0 };
      const val = toKRW(n(a.currentValue) || n(a.quantity) * n(a.currentPrice), a.currency, exchangeRate);
      const inv = toKRW(n(a.investedValue) || n(a.quantity) * n(a.avgPrice), a.currency, exchangeRate);
      map[type].value += val;
      map[type].invested += inv;
      map[type].count += 1;
    });

    const icons: Record<string, string> = {
      STOCK_KR: "📈", STOCK_US: "📈", CRYPTO: "⛓", CASH: "🏦",
      BOND: "📄", FUND: "💼", REAL_ESTATE: "🏠", GOLD: "🪙", OTHER: "📦",
    };

    return Object.entries(map).map(([type, d]) => {
      const change = d.invested > 0 ? ((d.value - d.invested) / d.invested) * 100 : 0;
      return {
        title: ASSET_TYPE_LABELS[type] || type,
        icon: icons[type] || "📦",
        value: d.value,
        change,
        positive: change >= 0,
        badge: `${d.count}종목`,
      };
    }).sort((a, b) => b.value - a.value);
  }, [assets, exchangeRate]);

  const avgIncome = cashflowData.reduce((s, c) => s + c.income, 0) / (cashflowData.length || 1);
  const avgExpense = cashflowData.reduce((s, c) => s + c.expense, 0) / (cashflowData.length || 1);
  const avgNet = avgIncome - avgExpense;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-500">불러오는 중...</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Hero: 현재 순자산 ── */}
      <NetWorthHero
        netWorth={netWorth}
        changeAmount={changeAmount}
        changeRate={changeRate}
        metrics={metrics}
      />

      {/* ── Row 1: 순자산 추이 + 자산 배분 ── */}
      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title="순자산 변동 추이">
          {networthHistory.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">데이터가 없습니다.</p>
          ) : (
            <NetWorthChart data={networthHistory} />
          )}
        </Card>

        <Card title="자산 배분">
          {allocation.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">등록된 자산이 없습니다.</p>
          ) : (
            <AllocationDonut data={allocation} />
          )}
        </Card>
      </div>

      {/* ── Row 2: 현금 흐름 + 은퇴 시뮬레이터 ── */}
      <div className="mb-6 grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card title="월간 현금 흐름">
          <div className="mb-4 grid grid-cols-3 gap-3">
            {[
              { label: "평균 수입", value: avgIncome, color: "text-indigo-400" },
              { label: "평균 지출", value: avgExpense, color: "text-rose-400" },
              { label: "평균 순저축", value: avgNet, color: "text-emerald-400" },
            ].map((m) => (
              <div
                key={m.label}
                className="flex flex-col items-center rounded-xl border border-slate-700 bg-slate-800/60 py-3"
              >
                <span className="text-[10px] text-slate-500">{m.label}</span>
                <span className={`text-sm font-bold tabular-nums ${m.color}`}>
                  {m.value === 0 ? "0원" : formatKRW(m.value)}
                </span>
              </div>
            ))}
          </div>
          <CashFlowChart data={cashflowData} />
        </Card>

        <Card
          title="은퇴 시뮬레이터"
          action={
            <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300">
              Monte Carlo · Bootstrap
            </span>
          }
        >
          <RetirementSimulator currentNetWorth={netWorth} annualDividendIncome={annualDividendIncome} />
        </Card>
      </div>

      {/* ── Row 3: 자산 카테고리 요약 ── */}
      {categorySummary.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-slate-500">
            등록된 자산이 없습니다. 주식 현황이나 코인 현황에서 자산을 추가해보세요.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {categorySummary.map((item) => (
            <Card key={item.title}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-400">{item.title}</p>
                    <p className="text-xl font-bold tabular-nums text-slate-100">
                      {formatKRW(item.value)}
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
                    {item.change >= 0 ? "+" : ""}{item.change.toFixed(1)}%
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
