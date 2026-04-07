"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card } from "@/components";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── 타입 ───
interface Transaction {
  _id: string;
  transactionType: string;
  currency: string;
  totalAmount: number;
  fee: number;
  date: string;
  category?: string;
  description?: string;
  memo?: string;
  assetId?: string;
}

interface Asset {
  _id: string;
  name: string;
  assetType: string;
  currency: string;
  quantity: number;
  currentPrice: number;
  currentValue: number;
  dividendYield?: number;
  dividendFrequency?: string;
  lastDividendDate?: string;
}

// ─── 상수 ───
const CATEGORIES = ["식비", "교통비", "주거비", "통신비", "의료비", "쇼핑", "문화/여가", "교육", "보험", "기타"];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const EMPTY_FORM = {
  transactionType: "WITHDRAWAL" as string,
  totalAmount: "",
  category: "식비",
  description: "",
  date: new Date().toISOString().slice(0, 10),
  memo: "",
  isFixed: false,
  assetId: "",
};

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}
function fmtAxis(v: number) {
  if (Math.abs(v) >= 1_0000) return `${Math.round(v / 1_0000)}만`;
  return String(v);
}

// ─── 캘린더 유틸 ───
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// ─── 차트 툴팁 ───
const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 shadow-xl">
      <p className="mb-2 text-xs font-medium text-slate-400">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-sm">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-xs text-slate-400">{p.name}</span>
          <span className="ml-auto font-bold tabular-nums text-slate-100">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

export default function BudgetPage() {
  // ─── 상태 ───
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);

  // 캘린더 현재 월
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  // ─── 데이터 페치 ───
  const fetchTx = useCallback(async () => {
    try {
      const [txRes, assetRes] = await Promise.all([
        fetch("/api/transactions?limit=1000"),
        fetch("/api/assets?active=true"),
      ]);
      const txData = await txRes.json();
      const assetData = await assetRes.json();
      setTransactions(Array.isArray(txData?.items) ? txData.items : Array.isArray(txData) ? txData : []);
      setAssets(Array.isArray(assetData) ? assetData : []);
    } catch {
      /* 연결 실패 시 빈 배열 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTx(); }, [fetchTx]);

  // ─── CRUD ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      transactionType: form.transactionType,
      totalAmount: Number(form.totalAmount),
      category: form.category,
      description: form.description,
      date: form.date,
      memo: form.isFixed ? "고정지출" : form.memo,
      currency: "KRW",
    };
    if (form.assetId) payload.assetId = form.assetId;

    if (editId) {
      await fetch(`/api/transactions/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    setForm(EMPTY_FORM);
    setEditId(null);
    fetchTx();
  };

  const handleEdit = (t: Transaction) => {
    setEditId(t._id);
    setForm({
      transactionType: t.transactionType,
      totalAmount: String(t.totalAmount),
      category: t.category || "기타",
      description: t.description || "",
      date: t.date ? t.date.slice(0, 10) : "",
      memo: t.memo || "",
      isFixed: t.memo === "고정지출",
      assetId: t.assetId || "",
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    fetchTx();
  };

  const handleCancel = () => { setForm(EMPTY_FORM); setEditId(null); };

  // CASH 계좌 목록
  const cashAccounts = assets.filter((a) => a.assetType === "CASH");

  // ─── 캘린더 데이터 ───
  const calMonthStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
  const monthTx = transactions.filter((t) => t.date?.startsWith(calMonthStr));

  const dayMap = useMemo(() => {
    const map: Record<number, { income: number; expense: number }> = {};
    monthTx.forEach((t) => {
      const day = new Date(t.date).getDate();
      if (!map[day]) map[day] = { income: 0, expense: 0 };
      if (t.transactionType === "DEPOSIT" || t.transactionType === "INTEREST" || t.transactionType === "DIVIDEND") {
        map[day].income += t.totalAmount;
      } else {
        map[day].expense += t.totalAmount;
      }
    });
    return map;
  }, [monthTx]);

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfWeek(calYear, calMonth);

  // ─── 예정 배당금 (자산 기반) ───
  const expectedDividends = useMemo(() => {
    const map: Record<number, number> = {};
    const month0 = calMonth; // 0-indexed

    assets.forEach((a) => {
      const yieldPct = a.dividendYield ?? 0;
      const freq = a.dividendFrequency ?? "NONE";
      if (yieldPct <= 0 || freq === "NONE") return;

      // 이 월에 배당이 지급되는지 판정
      let paysThisMonth = false;
      switch (freq) {
        case "MONTHLY":
          paysThisMonth = true;
          break;
        case "QUARTERLY":
          // 3, 6, 9, 12월 (0-indexed: 2, 5, 8, 11)
          paysThisMonth = (month0 + 1) % 3 === 0;
          break;
        case "SEMI_ANNUALLY":
          // 6, 12월 (0-indexed: 5, 11)
          paysThisMonth = (month0 + 1) % 6 === 0;
          break;
        case "ANNUALLY":
          // 12월 (0-indexed: 11)
          paysThisMonth = month0 === 11;
          break;
      }
      if (!paysThisMonth) return;

      const currentVal = a.currentValue ?? a.quantity * a.currentPrice;
      const annualDiv = currentVal * (yieldPct / 100);

      let perPayment = 0;
      switch (freq) {
        case "MONTHLY":      perPayment = annualDiv / 12; break;
        case "QUARTERLY":    perPayment = annualDiv / 4;  break;
        case "SEMI_ANNUALLY": perPayment = annualDiv / 2; break;
        case "ANNUALLY":     perPayment = annualDiv;      break;
      }

      // 월말(마지막 영업일 근사) 지급으로 간주
      const payDay = getDaysInMonth(calYear, calMonth);
      map[payDay] = (map[payDay] || 0) + perPayment;
    });

    return map;
  }, [assets, calYear, calMonth]);

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11); }
    else setCalMonth(calMonth - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0); }
    else setCalMonth(calMonth + 1);
  };

  // ─── 카테고리별 지출 (현재 월) ───
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    monthTx.forEach((t) => {
      if (t.transactionType === "DEPOSIT" || t.transactionType === "INTEREST" || t.transactionType === "DIVIDEND") return;
      const cat = t.category || "기타";
      map[cat] = (map[cat] || 0) + t.totalAmount;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthTx]);

  // ─── 고정지출 ───
  const fixedExpenses = transactions.filter((t) => t.memo === "고정지출");

  // ─── 연간 수입/지출 (최근 12개월) ───
  const annualData = useMemo(() => {
    const months: { month: string; income: number; expense: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${d.getMonth() + 1}월`;
      let income = 0, expense = 0;
      transactions.forEach((t) => {
        if (!t.date?.startsWith(key)) return;
        if (t.transactionType === "DEPOSIT" || t.transactionType === "INTEREST" || t.transactionType === "DIVIDEND") {
          income += t.totalAmount;
        } else {
          expense += t.totalAmount;
        }
      });
      months.push({ month: label, income, expense });
    }
    return months;
  }, [transactions, today]);

  const inputCls = "w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:outline-none";
  const labelCls = "block text-xs font-medium text-slate-400 mb-1";

  const monthIncome = monthTx.reduce((s, t) => {
    if (t.transactionType === "DEPOSIT" || t.transactionType === "INTEREST" || t.transactionType === "DIVIDEND") return s + t.totalAmount;
    return s;
  }, 0);
  const monthExpense = monthTx.reduce((s, t) => {
    if (t.transactionType === "DEPOSIT" || t.transactionType === "INTEREST" || t.transactionType === "DIVIDEND") return s;
    return s + t.totalAmount;
  }, 0);

  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">가계부</h2>

      {/* 월간 요약 */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
          <span className="text-sm text-slate-400">이번 달 수입</span>
          <p className="text-2xl font-bold tabular-nums text-indigo-400">{fmt(monthIncome)}</p>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
          <span className="text-sm text-slate-400">이번 달 지출</span>
          <p className="text-2xl font-bold tabular-nums text-rose-400">{fmt(monthExpense)}</p>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
          <span className="text-sm text-slate-400">순저축</span>
          <p className={`text-2xl font-bold tabular-nums ${monthIncome - monthExpense >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {fmt(monthIncome - monthExpense)}
          </p>
        </div>
      </div>

      {/* 거래 입력 폼 */}
      <Card title={editId ? "거래 수정" : "거래 추가"} className="mb-6">
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelCls}>유형</label>
            <select value={form.transactionType} onChange={(e) => setForm({ ...form, transactionType: e.target.value })} className={inputCls}>
              <option value="WITHDRAWAL">지출</option>
              <option value="DEPOSIT">수입</option>
              <option value="DIVIDEND">배당금</option>
              <option value="INTEREST">이자</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>금액 *</label>
            <input required type="number" step="any" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} className={inputCls} placeholder="0" />
          </div>
          <div>
            <label className={labelCls}>카테고리</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>날짜 *</label>
            <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>계좌/통장</label>
            <select value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })} className={inputCls}>
              <option value="">선택 안함</option>
              {cashAccounts.map((a) => (
                <option key={a._id} value={a._id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>설명</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} placeholder="점심 식사" />
          </div>
          <div>
            <label className={labelCls}>메모</label>
            <input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className={inputCls} placeholder="메모 (선택)" disabled={form.isFixed} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={form.isFixed} onChange={(e) => setForm({ ...form, isFixed: e.target.checked, memo: e.target.checked ? "고정지출" : "" })} className="rounded border-slate-600" />
              고정지출
            </label>
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <button type="submit" className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              {editId ? "수정" : "추가"}
            </button>
            {editId && (
              <button type="button" onClick={handleCancel} className="rounded-lg bg-slate-600 px-6 py-2 text-sm font-semibold text-white hover:bg-slate-500">
                취소
              </button>
            )}
          </div>
        </form>
      </Card>

      {/* 캘린더 */}
      <Card title="캘린더" className="mb-6" action={
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="text-slate-400 hover:text-white">&lt;</button>
          <span className="text-sm font-semibold">{calYear}년 {calMonth + 1}월</span>
          <button onClick={nextMonth} className="text-slate-400 hover:text-white">&gt;</button>
        </div>
      }>
        {loading ? (
          <p className="text-sm text-slate-500">불러오는 중...</p>
        ) : (
          <div className="overflow-x-auto">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-1">
              {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
            </div>
            {/* 날짜 셀 */}
            <div className="grid grid-cols-7 gap-1">
              {/* 빈 칸 */}
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
              {/* 날짜 */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const data = dayMap[day];
                const divAmount = expectedDividends[day];
                const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                return (
                  <div
                    key={day}
                    className={`rounded-lg border p-1.5 text-center min-h-[60px] ${isToday ? "border-indigo-500 bg-indigo-500/10" : "border-slate-700/50 hover:bg-slate-700/30"}`}
                  >
                    <div className={`text-xs ${isToday ? "font-bold text-indigo-400" : "text-slate-400"}`}>{day}</div>
                    {data && (
                      <div className="mt-0.5 space-y-0.5">
                        {data.income > 0 && <div className="text-[9px] tabular-nums text-indigo-400 truncate">+{(data.income / 10000).toFixed(0)}만</div>}
                        {data.expense > 0 && <div className="text-[9px] tabular-nums text-rose-400 truncate">-{(data.expense / 10000).toFixed(0)}만</div>}
                      </div>
                    )}
                    {divAmount > 0 && (
                      <div className="mt-0.5 rounded border border-dashed border-emerald-500/50 bg-emerald-500/10 px-0.5 py-px">
                        <span className="text-[8px] font-medium tabular-nums text-emerald-400 truncate block">
                          예정 +{divAmount >= 10000 ? `${(divAmount / 10000).toFixed(0)}만` : fmt(divAmount)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* 카테고리별 지출 */}
        <Card title="카테고리별 지출" action={<span className="text-xs text-slate-500">{calYear}년 {calMonth + 1}월</span>}>
          {categoryData.length === 0 ? (
            <p className="text-sm text-slate-500">이번 달 지출 내역이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {categoryData.map((c) => {
                const max = categoryData[0]?.value || 1;
                const pct = (c.value / max) * 100;
                return (
                  <div key={c.name}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-slate-300">{c.name}</span>
                      <span className="font-bold tabular-nums text-slate-100">{fmt(c.value)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-700">
                      <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* 고정지출 관리 */}
        <Card title="고정지출 관리" action={<span className="text-xs text-slate-500">{fixedExpenses.length}건</span>}>
          {fixedExpenses.length === 0 ? (
            <p className="text-sm text-slate-500">등록된 고정지출이 없습니다. 거래 추가 시 &quot;고정지출&quot;을 체크하세요.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                    <th className="pb-2 pr-3">카테고리</th>
                    <th className="pb-2 pr-3">설명</th>
                    <th className="pb-2 pr-3 text-right">금액</th>
                    <th className="pb-2 pr-3">날짜</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {fixedExpenses.map((t) => (
                    <tr key={t._id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-2 pr-3 text-slate-300">{t.category || "-"}</td>
                      <td className="py-2 pr-3">{t.description || "-"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums font-medium text-rose-400">{fmt(t.totalAmount)}</td>
                      <td className="py-2 pr-3 text-slate-400 text-xs">{t.date?.slice(0, 10)}</td>
                      <td className="py-2 text-right">
                        <button onClick={() => handleEdit(t)} className="mr-2 text-xs text-indigo-400 hover:underline">수정</button>
                        <button onClick={() => handleDelete(t._id)} className="text-xs text-rose-400 hover:underline">삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* 연간 수입/지출 추이 */}
      <Card title="연간 수입/지출 추이" action={<span className="text-xs text-slate-500">최근 12개월</span>}>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-500">데이터가 없습니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={annualData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtAxis} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="income" name="수입" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={24} />
              <Bar dataKey="expense" name="지출" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* 최근 거래 내역 */}
      <Card title="최근 거래 내역" className="mt-6" action={<span className="text-xs text-slate-500">{transactions.length}건</span>}>
        {loading ? (
          <p className="text-sm text-slate-500">불러오는 중...</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-slate-500">등록된 거래가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                  <th className="pb-2 pr-3">날짜</th>
                  <th className="pb-2 pr-3">유형</th>
                  <th className="pb-2 pr-3">카테고리</th>
                  <th className="pb-2 pr-3">설명</th>
                  <th className="pb-2 pr-3 text-right">금액</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 30).map((t) => {
                  const isIncome = t.transactionType === "DEPOSIT" || t.transactionType === "INTEREST" || t.transactionType === "DIVIDEND";
                  return (
                    <tr key={t._id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-2 pr-3 text-xs text-slate-400">{t.date?.slice(0, 10)}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isIncome ? "bg-indigo-500/20 text-indigo-300" : "bg-rose-500/20 text-rose-300"}`}>
                          {isIncome ? "수입" : "지출"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-300">{t.category || "-"}</td>
                      <td className="py-2 pr-3">{t.description || "-"}</td>
                      <td className={`py-2 pr-3 text-right tabular-nums font-medium ${isIncome ? "text-indigo-400" : "text-rose-400"}`}>
                        {isIncome ? "+" : "-"}{fmt(t.totalAmount)}
                      </td>
                      <td className="py-2 text-right">
                        <button onClick={() => handleEdit(t)} className="mr-2 text-xs text-indigo-400 hover:underline">수정</button>
                        <button onClick={() => handleDelete(t._id)} className="text-xs text-rose-400 hover:underline">삭제</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
