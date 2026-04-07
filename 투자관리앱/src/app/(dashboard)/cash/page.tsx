"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, SummaryCard } from "@/components";

interface CashAsset {
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
}

const EMPTY_FORM = {
  name: "",
  ticker: "",
  quantity: "",
  exchange: "",
  memo: "",
};

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

export default function CashPage() {
  const [assets, setAssets] = useState<CashAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch("/api/assets?type=CASH");
      const data = await res.json();
      setAssets(Array.isArray(data) ? data : []);
    } catch {
      /* 연결 실패 시 빈 배열 유지 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      ticker: form.ticker,
      assetType: "CASH",
      currency: "KRW",
      quantity: Number(form.quantity),
      avgPrice: 1,
      currentPrice: 1,
      exchange: form.exchange,
      memo: form.memo,
    };

    if (editId) {
      await fetch(`/api/assets/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setForm(EMPTY_FORM);
    setEditId(null);
    fetchAssets();
  };

  const handleEdit = (a: CashAsset) => {
    setEditId(a._id);
    setForm({
      name: a.name,
      ticker: a.ticker || "",
      quantity: String(a.quantity),
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

  const totalBalance = assets.reduce((sum, a) => {
    return sum + (a.currentValue ?? a.quantity * 1);
  }, 0);

  const inputCls = "w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:outline-none";
  const labelCls = "block text-xs font-medium text-slate-400 mb-1";

  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">현금 / 예적금</h2>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <SummaryCard label="총 현금 잔액" value={fmt(totalBalance)} accentColor="blue" />
        <SummaryCard label="등록 계좌 수" value={`${assets.length}개`} />
      </div>

      {/* 계좌 추가/수정 폼 */}
      <Card title={editId ? "계좌 수정" : "계좌 추가"} className="mb-6">
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelCls}>계좌명 *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls}
              placeholder="국민은행 급여통장"
            />
          </div>
          <div>
            <label className={labelCls}>계좌번호/별칭</label>
            <input
              value={form.ticker}
              onChange={(e) => setForm({ ...form, ticker: e.target.value })}
              className={inputCls}
              placeholder="xxx-xxxx-xxxx"
            />
          </div>
          <div>
            <label className={labelCls}>현재 잔액 (원) *</label>
            <input
              required
              type="number"
              step="any"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className={inputCls}
              placeholder="0"
            />
          </div>
          <div>
            <label className={labelCls}>금융기관</label>
            <input
              value={form.exchange}
              onChange={(e) => setForm({ ...form, exchange: e.target.value })}
              className={inputCls}
              placeholder="국민은행"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className={labelCls}>메모</label>
            <input
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              className={inputCls}
              placeholder="메모 (선택)"
            />
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {editId ? "수정" : "추가"}
            </button>
            {editId && (
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg bg-slate-600 px-6 py-2 text-sm font-semibold text-white hover:bg-slate-500"
              >
                취소
              </button>
            )}
          </div>
        </form>
      </Card>

      {/* 계좌 목록 */}
      <Card title="등록 계좌" action={<span className="text-xs text-slate-500">{assets.length}개</span>}>
        {loading ? (
          <p className="text-sm text-slate-500">불러오는 중...</p>
        ) : assets.length === 0 ? (
          <p className="text-sm text-slate-500">등록된 계좌가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {assets.map((a) => {
              const balance = a.currentValue ?? a.quantity * 1;
              return (
                <div
                  key={a._id}
                  className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-5 py-4 transition-colors hover:bg-slate-700/40"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-lg">
                      🏦
                    </div>
                    <div>
                      <p className="font-medium text-slate-100">{a.name}</p>
                      <p className="text-xs text-slate-500">
                        {a.exchange || "기타"}{a.ticker ? ` · ${a.ticker}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-lg font-bold tabular-nums text-emerald-400">{fmt(balance)}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(a)}
                        className="text-xs text-indigo-400 hover:underline"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(a._id)}
                        className="text-xs text-rose-400 hover:underline"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
