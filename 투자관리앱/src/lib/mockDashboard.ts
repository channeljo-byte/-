/**
 * mockDashboard.ts — 대시보드 시연용 목 데이터
 *
 * 실제 DB 연동 전까지 사용합니다.
 * API 연동 시 이 파일의 함수들을 실제 fetch 로 교체하세요.
 */

import type { NetWorthDataPoint } from "@/components/dashboard/NetWorthChart";
import type { CashFlowDataPoint } from "@/components/dashboard/CashFlowChart";

// ── 순자산 12개월 이력 ────────────────────────────────────────────────────
export const MOCK_NETWORTH_HISTORY: NetWorthDataPoint[] = [
  { month: "2024.05", assets: 280_000_000, liabilities: 50_000_000, netWorth: 230_000_000 },
  { month: "2024.06", assets: 295_000_000, liabilities: 48_000_000, netWorth: 247_000_000 },
  { month: "2024.07", assets: 310_000_000, liabilities: 46_000_000, netWorth: 264_000_000 },
  { month: "2024.08", assets: 288_000_000, liabilities: 45_000_000, netWorth: 243_000_000 },
  { month: "2024.09", assets: 305_000_000, liabilities: 44_000_000, netWorth: 261_000_000 },
  { month: "2024.10", assets: 322_000_000, liabilities: 42_000_000, netWorth: 280_000_000 },
  { month: "2024.11", assets: 315_000_000, liabilities: 41_000_000, netWorth: 274_000_000 },
  { month: "2024.12", assets: 340_000_000, liabilities: 40_000_000, netWorth: 300_000_000 },
  { month: "2025.01", assets: 352_000_000, liabilities: 39_000_000, netWorth: 313_000_000 },
  { month: "2025.02", assets: 360_000_000, liabilities: 38_000_000, netWorth: 322_000_000 },
  { month: "2025.03", assets: 375_000_000, liabilities: 37_000_000, netWorth: 338_000_000 },
  { month: "2025.04", assets: 423_000_000, liabilities: 36_000_000, netWorth: 387_000_000 },
];

// ── 월간 현금 흐름 6개월 ──────────────────────────────────────────────────
export const MOCK_CASHFLOW: CashFlowDataPoint[] = [
  { month: "11월", income: 4_200_000, expense: 2_950_000, net: 1_250_000 },
  { month: "12월", income: 5_800_000, expense: 3_800_000, net: 2_000_000 },
  { month: "1월",  income: 4_100_000, expense: 2_700_000, net: 1_400_000 },
  { month: "2월",  income: 4_200_000, expense: 2_600_000, net: 1_600_000 },
  { month: "3월",  income: 4_500_000, expense: 3_100_000, net: 1_400_000 },
  { month: "4월",  income: 4_200_000, expense: 2_850_000, net: 1_350_000 },
];

// ── 자산 배분 ─────────────────────────────────────────────────────────────
export const MOCK_ALLOCATION = [
  { name: "국내 주식",   value: 120_000_000, color: "#6366f1" },
  { name: "미국 주식/ETF", value: 95_000_000, color: "#8b5cf6" },
  { name: "암호화폐",   value: 45_000_000,  color: "#f59e0b" },
  { name: "예금/현금",  value: 130_000_000, color: "#10b981" },
  { name: "채권/펀드",  value: 33_000_000,  color: "#06b6d4" },
];

// ── 현재 순자산 스냅샷 ────────────────────────────────────────────────────
const latest = MOCK_NETWORTH_HISTORY[MOCK_NETWORTH_HISTORY.length - 1];
const prev    = MOCK_NETWORTH_HISTORY[MOCK_NETWORTH_HISTORY.length - 2];

export const MOCK_SNAPSHOT = {
  netWorth:     latest.netWorth,
  totalAssets:  latest.assets,
  totalDebt:    latest.liabilities,
  changeAmount: latest.netWorth - prev.netWorth,
  changeRate:   (latest.netWorth - prev.netWorth) / prev.netWorth,
};

// ── Hero 보조 지표 ────────────────────────────────────────────────────────
export const MOCK_METRICS = [
  { label: "총자산",     value: latest.assets,          highlight: false },
  { label: "총부채",     value: -latest.liabilities,    highlight: true  },
  { label: "이달 수입",  value: MOCK_CASHFLOW.at(-1)!.income,   highlight: false },
  { label: "이달 지출",  value: -MOCK_CASHFLOW.at(-1)!.expense, highlight: true  },
  { label: "이달 순저축",value: MOCK_CASHFLOW.at(-1)!.net,      highlight: true  },
];
