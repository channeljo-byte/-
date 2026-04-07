"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, SummaryCard } from "@/components";

interface CryptoAsset {
  _id: string;
  name: string;
  ticker?: string;
  assetType: string;
  currency: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  exchange?: string;
  memo?: string;
  investedValue: number;
  currentValue: number;
  profitLoss: number;
  profitLossRate: number;
}

const EMPTY_FORM = {
  name: "",
  ticker: "",
  quantity: "",
  avgPrice: "",
  currentPrice: "",
  exchange: "",
  memo: "",
};

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function fmtRate(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function fmtQty(n: number) {
  if (n >= 1) return n.toLocaleString("ko-KR", { maximumFractionDigits: 4 });
  return n.toFixed(8);
}

export default function CryptoPage() {
  const [assets, setAssets] = useState<CryptoAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [priceFetching, setPriceFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const tickerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch("/api/assets?type=CRYPTO");
      const data = await res.json();
      setAssets(Array.isArray(data) ? data : []);
    } catch {
      /* 연결 실패 시 빈 배열 유지 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  // 티커 입력 시 자동 시세 조회 (debounce 500ms)
  const fetchTickerPrice = useCallback(async (ticker: string) => {
    if (!ticker || ticker.length < 2) return;
    setPriceFetching(true);
    try {
      const res = await fetch(`/api/price?ticker=${encodeURIComponent(ticker)}&type=CRYPTO`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.price) {
        setForm((prev) => ({
          ...prev,
          currentPrice: String(data.price),
          name: prev.name || data.name || ticker.toUpperCase(),
        }));
      }
    } catch { /* 무시 */ } finally {
      setPriceFetching(false);
    }
  }, []);

  const handleTickerChange = (value: string) => {
    setForm({ ...form, ticker: value });
    if (tickerTimerRef.current) clearTimeout(tickerTimerRef.current);
    tickerTimerRef.current = setTimeout(() => fetchTickerPrice(value), 500);
  };

  // 전체 보유 코인 시세 새로고침
  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      const updates = await Promise.allSettled(
        assets.filter((a) => a.ticker).map(async (a) => {
          const res = await fetch(`/api/price?ticker=${encodeURIComponent(a.ticker!)}&type=CRYPTO`);
          if (!res.ok) return null;
          const data = await res.json();
          if (data.price && data.price !== a.currentPrice) {
            await fetch(`/api/assets/${a._id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ currentPrice: data.price }),
            });
            return data.price;
          }
          return null;
        }),
      );
      const updated = updates.filter((r) => r.status === "fulfilled" && r.value !== null).length;
      if (updated > 0) fetchAssets();
    } catch { /* 무시 */ } finally {
      setRefreshing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      ticker: form.ticker,
      assetType: "CRYPTO",
      currency: "KRW",
      quantity: Number(form.quantity),
      avgPrice: Number(form.avgPrice),
      currentPrice: Number(form.currentPrice),
      exchange: form.exchange,
      memo: form.memo,
    };

    if (editId) {
      await fetch(`/api/assets/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      await fetch("/api/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    setForm(EMPTY_FORM);
    setEditId(null);
    fetchAssets();
  };

  const handleEdit = (a: CryptoAsset) => {
    setEditId(a._id);
    setForm({
      name: a.name,
      ticker: a.ticker || "",
      quantity: String(a.quantity),
      avgPrice: String(a.avgPrice),
      currentPrice: String(a.currentPrice),
      exchange: a.exchange || "",
      memo: a.memo || "",
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/assets/${id}`, { method: "DELETE" });
    fetchAssets();
  };

  const handleCancel = () => { setForm(EMPTY_FORM); setEditId(null); };

  const totalInvested = assets.reduce((s, a) => s + (a.investedValue ?? a.quantity * a.avgPrice), 0);
  const totalCurrent = assets.reduce((s, a) => s + (a.currentValue ?? a.quantity * a.currentPrice), 0);
  const totalRate = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;

  const inputCls = "w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:outline-none";
  const labelCls = "block text-xs font-medium text-slate-400 mb-1";

  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">코인 현황</h2>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="총 투자금" value={fmt(totalInvested)} />
        <SummaryCard label="총 평가액" value={fmt(totalCurrent)} />
        <SummaryCard
          label="총 수익률"
          value={fmtRate(totalRate)}
          accentColor={totalRate >= 0 ? "blue" : "red"}
        />
      </div>

      {/* 코인 추가/수정 폼 */}
      <Card title={editId ? "코인 수정" : "코인 추가"} className="mb-6">
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelCls}>코인명 *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="비트코인" />
          </div>
          <div>
            <label className={labelCls}>티커 {priceFetching && <span className="text-indigo-400">(시세 조회 중...)</span>}</label>
            <input value={form.ticker} onChange={(e) => handleTickerChange(e.target.value)} className={inputCls} placeholder="BTC" />
          </div>
          <div>
            <label className={labelCls}>보유 수량 *</label>
            <input required type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={inputCls} placeholder="0.00000000" />
          </div>
          <div>
            <label className={labelCls}>평균 매입가 (원) *</label>
            <input required type="number" step="any" value={form.avgPrice} onChange={(e) => setForm({ ...form, avgPrice: e.target.value })} className={inputCls} placeholder="0" />
          </div>
          <div>
            <label className={labelCls}>현재가 (원) *</label>
            <input required type="number" step="any" value={form.currentPrice} onChange={(e) => setForm({ ...form, currentPrice: e.target.value })} className={inputCls} placeholder="0" />
          </div>
          <div>
            <label className={labelCls}>거래소</label>
            <input value={form.exchange} onChange={(e) => setForm({ ...form, exchange: e.target.value })} className={inputCls} placeholder="업비트" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>메모</label>
            <input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className={inputCls} placeholder="메모 (선택)" />
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

      {/* 보유 코인 테이블 */}
      <Card title="보유 코인" action={
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefreshAll}
            disabled={refreshing || assets.length === 0}
            className="rounded-lg border border-slate-600 px-3 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {refreshing ? "조회 중..." : "시세 새로고침"}
          </button>
          <span className="text-xs text-slate-500">{assets.length}종목</span>
        </div>
      }>
        {loading ? (
          <p className="text-sm text-slate-500">불러오는 중...</p>
        ) : assets.length === 0 ? (
          <p className="text-sm text-slate-500">등록된 코인이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                  <th className="pb-2 pr-4">코인명</th>
                  <th className="pb-2 pr-4">티커</th>
                  <th className="pb-2 pr-4">거래소</th>
                  <th className="pb-2 pr-4 text-right">보유수량</th>
                  <th className="pb-2 pr-4 text-right">평균매입가</th>
                  <th className="pb-2 pr-4 text-right">현재가</th>
                  <th className="pb-2 pr-4 text-right">투자금</th>
                  <th className="pb-2 pr-4 text-right">평가액</th>
                  <th className="pb-2 pr-4 text-right">수익률</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => {
                  const invested = a.investedValue ?? a.quantity * a.avgPrice;
                  const current = a.currentValue ?? a.quantity * a.currentPrice;
                  const rate = a.profitLossRate ?? (invested > 0 ? ((current - invested) / invested) * 100 : 0);
                  return (
                    <tr key={a._id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-2.5 pr-4 font-medium">{a.name}</td>
                      <td className="py-2.5 pr-4 text-slate-400">{a.ticker || "-"}</td>
                      <td className="py-2.5 pr-4 text-slate-400">{a.exchange || "-"}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{fmtQty(a.quantity)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(a.avgPrice)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(a.currentPrice)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(invested)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(current)}</td>
                      <td className={`py-2.5 pr-4 text-right tabular-nums font-bold ${rate >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmtRate(rate)}</td>
                      <td className="py-2.5 text-right">
                        <button onClick={() => handleEdit(a)} className="mr-2 text-xs text-indigo-400 hover:underline">수정</button>
                        <button onClick={() => handleDelete(a._id)} className="text-xs text-rose-400 hover:underline">삭제</button>
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
