"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, SummaryCard } from "@/components";

interface StockAsset {
  _id: string;
  name: string;
  ticker?: string;
  assetType: "STOCK_KR" | "STOCK_US";
  currency: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  exchange?: string;
  sector?: string;
  memo?: string;
  dividendYield?: number;
  dividendFrequency?: string;
  investedValue: number;
  currentValue: number;
  profitLoss: number;
  profitLossRate: number;
}

const EMPTY_FORM = {
  name: "",
  ticker: "",
  assetType: "STOCK_KR" as "STOCK_KR" | "STOCK_US",
  currency: "KRW",
  quantity: "",
  avgPrice: "",
  currentPrice: "",
  exchange: "",
  sector: "",
  memo: "",
  dividendYield: "",
  dividendFrequency: "NONE",
};

function fmt(n: number, currency = "KRW") {
  if (currency === "USD") return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function fmtRate(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export default function StocksPage() {
  const [assets, setAssets] = useState<StockAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState(1370);
  const [rateInput, setRateInput] = useState("1370");
  const [priceFetching, setPriceFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const tickerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("usdkrw");
    if (saved) {
      const v = Number(saved);
      if (v > 0) { setExchangeRate(v); setRateInput(saved); }
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      const [krRes, usRes] = await Promise.all([
        fetch("/api/assets?type=STOCK_KR"),
        fetch("/api/assets?type=STOCK_US"),
      ]);
      const kr = await krRes.json();
      const us = await usRes.json();
      setAssets([...(Array.isArray(kr) ? kr : []), ...(Array.isArray(us) ? us : [])]);
    } catch {
      /* API 연결 실패 시 빈 배열 유지 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  // 티커 입력 시 자동 시세 조회 (debounce 500ms)
  const fetchTickerPrice = useCallback(async (ticker: string, type: "STOCK_KR" | "STOCK_US") => {
    if (!ticker || ticker.length < 1) return;
    setPriceFetching(true);
    try {
      const res = await fetch(`/api/price?ticker=${encodeURIComponent(ticker)}&type=${type}`);
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
    setForm((prev) => ({ ...prev, ticker: value }));
    if (tickerTimerRef.current) clearTimeout(tickerTimerRef.current);
    tickerTimerRef.current = setTimeout(() => fetchTickerPrice(value, form.assetType), 500);
  };

  // 전체 보유 종목 시세 새로고침
  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled(
        assets.filter((a) => a.ticker).map(async (a) => {
          const res = await fetch(`/api/price?ticker=${encodeURIComponent(a.ticker!)}&type=${a.assetType}`);
          if (!res.ok) return;
          const data = await res.json();
          if (data.price && data.price !== a.currentPrice) {
            await fetch(`/api/assets/${a._id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ currentPrice: data.price }),
            });
          }
        }),
      );
      fetchAssets();
    } catch { /* 무시 */ } finally {
      setRefreshing(false);
    }
  };

  const handleSaveRate = () => {
    const v = Number(rateInput);
    if (v > 0) {
      setExchangeRate(v);
      localStorage.setItem("usdkrw", String(v));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      currency: form.assetType === "STOCK_US" ? "USD" : "KRW",
      quantity: Number(form.quantity),
      avgPrice: Number(form.avgPrice),
      currentPrice: Number(form.currentPrice),
      dividendYield: Number(form.dividendYield) || 0,
      dividendFrequency: form.dividendFrequency,
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

  const handleEdit = (a: StockAsset) => {
    setEditId(a._id);
    setForm({
      name: a.name,
      ticker: a.ticker || "",
      assetType: a.assetType,
      currency: a.currency,
      quantity: String(a.quantity),
      avgPrice: String(a.avgPrice),
      currentPrice: String(a.currentPrice),
      exchange: a.exchange || "",
      sector: a.sector || "",
      memo: a.memo || "",
      dividendYield: String(a.dividendYield ?? ""),
      dividendFrequency: a.dividendFrequency || "NONE",
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/assets/${id}`, { method: "DELETE" });
    fetchAssets();
  };

  const handleCancel = () => { setForm(EMPTY_FORM); setEditId(null); };

  const krStocks = assets.filter((a) => a.assetType === "STOCK_KR");
  const usStocks = assets.filter((a) => a.assetType === "STOCK_US");

  // 원화 환산 합계
  const totalInvested = assets.reduce((sum, a) => {
    const v = a.investedValue ?? a.quantity * a.avgPrice;
    return sum + (a.currency === "USD" ? v * exchangeRate : v);
  }, 0);
  const totalCurrent = assets.reduce((sum, a) => {
    const v = a.currentValue ?? a.quantity * a.currentPrice;
    return sum + (a.currency === "USD" ? v * exchangeRate : v);
  }, 0);
  const totalRate = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;

  const inputCls = "w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:outline-none";
  const labelCls = "block text-xs font-medium text-slate-400 mb-1";

  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">주식 현황</h2>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="총 투자금 (원화 환산)" value={fmt(totalInvested)} />
        <SummaryCard label="총 평가액 (원화 환산)" value={fmt(totalCurrent)} />
        <SummaryCard
          label="총 수익률"
          value={fmtRate(totalRate)}
          accentColor={totalRate >= 0 ? "blue" : "red"}
        />
      </div>

      {/* 환율 설정 */}
      <Card title="환율 (USD/KRW)" className="mb-6">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className={labelCls}>현재 환율</label>
            <input
              type="number"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              className={inputCls}
              step="0.01"
            />
          </div>
          <button
            onClick={handleSaveRate}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            저장
          </button>
          <p className="pb-2 text-xs text-slate-500">
            적용 중: <span className="font-bold text-indigo-400">{exchangeRate.toLocaleString()}원</span>
          </p>
        </div>
      </Card>

      {/* 종목 추가/수정 폼 */}
      <Card title={editId ? "종목 수정" : "종목 추가"} className="mb-6">
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelCls}>시장</label>
            <select
              value={form.assetType}
              onChange={(e) => setForm({ ...form, assetType: e.target.value as "STOCK_KR" | "STOCK_US", currency: e.target.value === "STOCK_US" ? "USD" : "KRW" })}
              className={inputCls}
            >
              <option value="STOCK_KR">한국 주식</option>
              <option value="STOCK_US">미국 주식/ETF</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>종목명 *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="삼성전자" />
          </div>
          <div>
            <label className={labelCls}>티커 {priceFetching && <span className="text-indigo-400">(시세 조회 중...)</span>}</label>
            <input value={form.ticker} onChange={(e) => handleTickerChange(e.target.value)} className={inputCls} placeholder="005930" />
          </div>
          <div>
            <label className={labelCls}>수량 *</label>
            <input required type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={inputCls} placeholder="0" />
          </div>
          <div>
            <label className={labelCls}>평균 매입가 *</label>
            <input required type="number" step="any" value={form.avgPrice} onChange={(e) => setForm({ ...form, avgPrice: e.target.value })} className={inputCls} placeholder="0" />
          </div>
          <div>
            <label className={labelCls}>현재가 *</label>
            <input required type="number" step="any" value={form.currentPrice} onChange={(e) => setForm({ ...form, currentPrice: e.target.value })} className={inputCls} placeholder="0" />
          </div>
          <div>
            <label className={labelCls}>거래소</label>
            <input value={form.exchange} onChange={(e) => setForm({ ...form, exchange: e.target.value })} className={inputCls} placeholder="KRX" />
          </div>
          <div>
            <label className={labelCls}>섹터</label>
            <input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} className={inputCls} placeholder="반도체" />
          </div>
          <div>
            <label className={labelCls}>배당수익률 (%)</label>
            <input type="number" step="0.01" value={form.dividendYield} onChange={(e) => setForm({ ...form, dividendYield: e.target.value })} className={inputCls} placeholder="0.00" />
          </div>
          <div>
            <label className={labelCls}>배당 주기</label>
            <select value={form.dividendFrequency} onChange={(e) => setForm({ ...form, dividendFrequency: e.target.value })} className={inputCls}>
              <option value="NONE">배당 없음</option>
              <option value="MONTHLY">월배당</option>
              <option value="QUARTERLY">분기배당</option>
              <option value="SEMI_ANNUALLY">반기배당</option>
              <option value="ANNUALLY">연배당</option>
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
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

      {/* 한국 주식 테이블 */}
      <Card title="한국 주식" className="mb-6" action={
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefreshAll}
            disabled={refreshing || assets.length === 0}
            className="rounded-lg border border-slate-600 px-3 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {refreshing ? "조회 중..." : "시세 새로고침"}
          </button>
          <span className="text-xs text-slate-500">{krStocks.length}종목</span>
        </div>
      }>
        {loading ? (
          <p className="text-sm text-slate-500">불러오는 중...</p>
        ) : krStocks.length === 0 ? (
          <p className="text-sm text-slate-500">등록된 한국 주식이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                  <th className="pb-2 pr-4">종목명</th>
                  <th className="pb-2 pr-4">티커</th>
                  <th className="pb-2 pr-4 text-right">수량</th>
                  <th className="pb-2 pr-4 text-right">평균단가</th>
                  <th className="pb-2 pr-4 text-right">현재가</th>
                  <th className="pb-2 pr-4 text-right">투자금</th>
                  <th className="pb-2 pr-4 text-right">평가액</th>
                  <th className="pb-2 pr-4 text-right">수익률</th>
                  <th className="pb-2 pr-4 text-right">연 예상배당</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {krStocks.map((s) => {
                  const invested = s.investedValue ?? s.quantity * s.avgPrice;
                  const current = s.currentValue ?? s.quantity * s.currentPrice;
                  const rate = s.profitLossRate ?? (invested > 0 ? ((current - invested) / invested) * 100 : 0);
                  const annualDiv = current * ((s.dividendYield ?? 0) / 100);
                  return (
                    <tr key={s._id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-2.5 pr-4 font-medium">{s.name}</td>
                      <td className="py-2.5 pr-4 text-slate-400">{s.ticker || "-"}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{s.quantity.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(s.avgPrice)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(s.currentPrice)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(invested)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(current)}</td>
                      <td className={`py-2.5 pr-4 text-right tabular-nums font-bold ${rate >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmtRate(rate)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-amber-400">{annualDiv > 0 ? fmt(annualDiv) : "-"}</td>
                      <td className="py-2.5 text-right">
                        <button onClick={() => handleEdit(s)} className="mr-2 text-xs text-indigo-400 hover:underline">수정</button>
                        <button onClick={() => handleDelete(s._id)} className="text-xs text-rose-400 hover:underline">삭제</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 미국 주식/ETF 테이블 */}
      <Card title="미국 주식 / ETF" action={<span className="text-xs text-slate-500">{usStocks.length}종목</span>}>
        {loading ? (
          <p className="text-sm text-slate-500">불러오는 중...</p>
        ) : usStocks.length === 0 ? (
          <p className="text-sm text-slate-500">등록된 미국 주식이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                  <th className="pb-2 pr-4">종목명</th>
                  <th className="pb-2 pr-4">티커</th>
                  <th className="pb-2 pr-4 text-right">수량</th>
                  <th className="pb-2 pr-4 text-right">평균단가</th>
                  <th className="pb-2 pr-4 text-right">현재가</th>
                  <th className="pb-2 pr-4 text-right">투자금(USD)</th>
                  <th className="pb-2 pr-4 text-right">평가액(USD)</th>
                  <th className="pb-2 pr-4 text-right">원화환산</th>
                  <th className="pb-2 pr-4 text-right">수익률</th>
                  <th className="pb-2 pr-4 text-right">연 예상배당</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {usStocks.map((s) => {
                  const invested = s.investedValue ?? s.quantity * s.avgPrice;
                  const current = s.currentValue ?? s.quantity * s.currentPrice;
                  const rate = s.profitLossRate ?? (invested > 0 ? ((current - invested) / invested) * 100 : 0);
                  const annualDiv = current * ((s.dividendYield ?? 0) / 100);
                  return (
                    <tr key={s._id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-2.5 pr-4 font-medium">{s.name}</td>
                      <td className="py-2.5 pr-4 text-slate-400">{s.ticker || "-"}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{s.quantity.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(s.avgPrice, "USD")}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(s.currentPrice, "USD")}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(invested, "USD")}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(current, "USD")}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-slate-400">{fmt(current * exchangeRate)}</td>
                      <td className={`py-2.5 pr-4 text-right tabular-nums font-bold ${rate >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmtRate(rate)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-amber-400">{annualDiv > 0 ? fmt(annualDiv, "USD") : "-"}</td>
                      <td className="py-2.5 text-right">
                        <button onClick={() => handleEdit(s)} className="mr-2 text-xs text-indigo-400 hover:underline">수정</button>
                        <button onClick={() => handleDelete(s._id)} className="text-xs text-rose-400 hover:underline">삭제</button>
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
