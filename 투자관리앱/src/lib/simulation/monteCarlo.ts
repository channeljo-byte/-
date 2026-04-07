/**
 * monteCarlo.ts — 몬테카를로 은퇴 시뮬레이션 엔진
 *
 * ─── 알고리즘 개요 ───────────────────────────────────────────────────
 * 1. 과거 수익률 풀에서 `totalYears`년치를 Bootstrap 복원 추출
 * 2. 해당 수익률 시퀀스로 단일 은퇴 궤적 시뮬레이션
 * 3. N번 반복 (기본: 10,000회)
 * 4. 생존(재무적 파산 없이 목표 수명 도달) 비율 = 재무적 생존 확률(%)
 *
 * ─── 수익률 순서 위험(Sequence of Returns Risk) ──────────────────────
 * 평균 수익률이 동일해도 수익률의 순서가 다르면 결과가 크게 달라집니다.
 * 특히 은퇴 직후 큰 손실이 발생하면 회복 기회가 없어 파산 위험이 급증합니다.
 * 몬테카를로는 수천 가지 서로 다른 수익률 시퀀스를 테스트하여
 * 이 위험을 정량적으로 측정합니다.
 *
 * ─── 병렬 처리 전략 ─────────────────────────────────────────────────
 * JavaScript는 싱글스레드이나, 10,000회 × 50년 = 500,000 스텝은
 * V8 엔진에서 <100ms에 완료됩니다.
 *
 * 비동기 버전(runMonteCarloAsync)은 100회씩 배치 처리하여
 * 이벤트 루프를 양보(yield)하므로 브라우저 UI가 블록되지 않습니다.
 * ─────────────────────────────────────────────────────────────────────
 */

import { simulateSinglePath, SimulationConfig, WithdrawalStrategy } from "./portfolioSimulator";
import {
  bootstrapSample,
  blockBootstrapSample,
  parametricSample,
  createSeededRng,
} from "./historicalReturns";

// ─────────────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────────────

/** 샘플링 방법 */
export type SamplingMethod =
  | "BOOTSTRAP"          // 단순 복원 추출 (기본)
  | "BLOCK_BOOTSTRAP"    // 블록 복원 추출 (자기상관 보존)
  | "PARAMETRIC";        // 정규분포 기반 GBM 근사

/** 몬테카를로 엔진 설정 */
export interface MonteCarloConfig {
  /** ─── 포트폴리오 초기 상태 ─── */
  initialBalance: number;

  /** ─── 적립기 ─── */
  annualContribution: number;
  accumulationYears: number;
  /** 납입금 연간 인상률 (기본: inflationRate) */
  contributionGrowthRate?: number;

  /** ─── 인출기 ─── */
  retirementYears: number;
  initialWithdrawalRate: number;
  withdrawalStrategy: WithdrawalStrategy;

  /** ─── 공통 ─── */
  inflationRate: number;

  /** ─── 몬테카를로 전용 설정 ─── */
  /**
   * 수익률 샘플링 풀. Bootstrap의 경우 과거 실제 수익률 배열,
   * Parametric의 경우 [mean, stdDev] 2원소 배열을 사용합니다.
   */
  historicalReturns: number[];
  /** 시뮬레이션 반복 횟수 (기본: 10,000) */
  numSimulations?: number;
  /** 샘플링 방법 (기본: BOOTSTRAP) */
  samplingMethod?: SamplingMethod;
  /** Block Bootstrap의 블록 크기 (기본: 3년) */
  blockSize?: number;
  /**
   * 재현 가능한 결과를 위한 시드.
   * 미지정 시 매 실행마다 다른 결과가 나옵니다.
   */
  seed?: number;
  /**
   * 진행률 콜백. 배치 완료 시마다 호출됩니다.
   * @param done  - 완료된 시뮬레이션 수
   * @param total - 전체 시뮬레이션 수
   */
  onProgress?: (done: number, total: number) => void;
}

/** 백분위 궤적 (연도별) */
export interface PercentileTrajectories {
  /** 5th 백분위 (최악 5%) */
  p5: Float64Array;
  /** 25th 백분위 (하위 25%) */
  p25: Float64Array;
  /** 50th 백분위 중앙값 */
  p50: Float64Array;
  /** 75th 백분위 (상위 25%) */
  p75: Float64Array;
  /** 95th 백분위 (최고 5%) */
  p95: Float64Array;
}

/** 최종 잔고 분포 통계 */
export interface BalanceDistribution {
  mean: number;
  median: number;
  min: number;
  max: number;
  /** 5th 백분위 (5%의 시뮬레이션이 이 값 이하) */
  p5: number;
  /** 95th 백분위 */
  p95: number;
  /** 표준편차 */
  stdDev: number;
}

/** 몬테카를로 시뮬레이션 결과 */
export interface MonteCarloResult {
  /** ─── 핵심 지표 ─── */
  /**
   * 재무적 생존 확률 (0~100%).
   * 목표 수명까지 자산이 고갈되지 않은 시뮬레이션의 비율.
   */
  survivalProbability: number;
  numSimulations: number;
  numSurvived: number;
  numRuined: number;

  /** ─── 자산 분포 ─── */
  /** 연도별 잔고 백분위 궤적 (총 연도 × 5개 백분위) */
  percentileTrajectories: PercentileTrajectories;
  /** 시뮬레이션 종료 시 최종 잔고 분포 통계 */
  finalBalanceDistribution: BalanceDistribution;
  /** 은퇴 시점 자산 중앙값 */
  medianBalanceAtRetirement: number;

  /** ─── 파산 분석 ─── */
  /**
   * 파산 연도별 빈도 히스토그램.
   * key: 총 경과 연도, value: 파산 시뮬레이션 수
   */
  ruinYearHistogram: Map<number, number>;
  /** 파산 시뮬레이션의 중앙 파산 연도 (생존 시 undefined) */
  medianRuinYear?: number;

  /** ─── 시뮬레이션 메타정보 ─── */
  config: {
    totalYears: number;
    samplingMethod: SamplingMethod;
    seed?: number;
  };
  /** 시뮬레이션 소요 시간 (ms) */
  elapsedMs: number;
}

// ─────────────────────────────────────────────────────────────────────
// 내부 유틸리티
// ─────────────────────────────────────────────────────────────────────

/** 배열의 p 백분위 값을 선형 보간으로 계산합니다. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** 연도별 잔고 행렬에서 백분위 궤적을 추출합니다. */
function computePercentileTrajectories(
  allBalances: Float64Array[],   // [numSimulations][totalYears+1]
  totalYears: number
): PercentileTrajectories {
  const p5  = new Float64Array(totalYears + 1);
  const p25 = new Float64Array(totalYears + 1);
  const p50 = new Float64Array(totalYears + 1);
  const p75 = new Float64Array(totalYears + 1);
  const p95 = new Float64Array(totalYears + 1);

  for (let year = 0; year <= totalYears; year++) {
    // 해당 연도의 모든 시뮬레이션 잔고를 정렬
    const yearBalances = allBalances
      .map((hist) => hist[year])
      .sort((a, b) => a - b);

    p5[year]  = percentile(yearBalances, 5);
    p25[year] = percentile(yearBalances, 25);
    p50[year] = percentile(yearBalances, 50);
    p75[year] = percentile(yearBalances, 75);
    p95[year] = percentile(yearBalances, 95);
  }

  return { p5, p25, p50, p75, p95 };
}

/** 최종 잔고 배열의 분포 통계를 계산합니다. */
function computeBalanceDistribution(finalBalances: number[]): BalanceDistribution {
  if (finalBalances.length === 0) {
    return { mean: 0, median: 0, min: 0, max: 0, p5: 0, p95: 0, stdDev: 0 };
  }

  const sorted = [...finalBalances].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;

  return {
    mean,
    median: percentile(sorted, 50),
    min: sorted[0],
    max: sorted[n - 1],
    p5: percentile(sorted, 5),
    p95: percentile(sorted, 95),
    stdDev: Math.sqrt(variance),
  };
}

/** 수익률 샘플러를 생성합니다. */
function createSampler(
  config: MonteCarloConfig,
  rng: () => number
): (years: number) => number[] {
  const method = config.samplingMethod ?? "BOOTSTRAP";

  switch (method) {
    case "BOOTSTRAP":
      return (years) => bootstrapSample(config.historicalReturns, years, rng);

    case "BLOCK_BOOTSTRAP":
      return (years) =>
        blockBootstrapSample(
          config.historicalReturns,
          years,
          config.blockSize ?? 3,
          rng
        );

    case "PARAMETRIC": {
      // historicalReturns를 실제 데이터로 사용하여 mean/stdDev 추정
      const data = config.historicalReturns;
      const mean = data.reduce((s, v) => s + v, 0) / data.length;
      const variance = data.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / data.length;
      const stdDev = Math.sqrt(variance);
      return (years) => parametricSample(mean, stdDev, years, rng);
    }
  }
}

/** 단일 시뮬레이션용 SimulationConfig를 조립합니다. */
function buildSimConfig(
  mc: MonteCarloConfig,
  annualReturns: number[]
): SimulationConfig {
  return {
    initialBalance: mc.initialBalance,
    annualContribution: mc.annualContribution,
    accumulationYears: mc.accumulationYears,
    contributionGrowthRate: mc.contributionGrowthRate,
    retirementYears: mc.retirementYears,
    initialWithdrawalRate: mc.initialWithdrawalRate,
    withdrawalStrategy: mc.withdrawalStrategy,
    inflationRate: mc.inflationRate,
    annualReturns,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 메인 엔진
// ─────────────────────────────────────────────────────────────────────

/**
 * 몬테카를로 시뮬레이션을 동기적으로 실행합니다.
 *
 * N번의 시뮬레이션을 순차적으로 실행하여 재무적 생존 확률을 계산합니다.
 * 서버 사이드 렌더링(SSR) 또는 Worker Thread에서 사용하세요.
 *
 * @param config - 몬테카를로 설정
 * @returns      - 시뮬레이션 결과 (생존 확률, 백분위 궤적, 파산 분석 등)
 *
 * @example
 * const result = runMonteCarlo({
 *   initialBalance:       100_000_000, // 1억원
 *   annualContribution:    12_000_000, // 연 1200만원
 *   accumulationYears:             20, // 20년 적립
 *   retirementYears:               30, // 30년 인출
 *   initialWithdrawalRate:       0.04, // 4% 룰
 *   withdrawalStrategy:  "CONSTANT_DOLLAR",
 *   inflationRate:               0.025,
 *   historicalReturns:   RETURN_PRESETS.SP500_FULL,
 *   numSimulations:            10_000,
 *   seed:                      42,     // 재현성
 * });
 * console.log(`생존 확률: ${result.survivalProbability.toFixed(1)}%`);
 */
export function runMonteCarlo(config: MonteCarloConfig): MonteCarloResult {
  const startTime = Date.now();
  const N = config.numSimulations ?? 10_000;
  const totalYears = config.accumulationYears + config.retirementYears;

  const rng = createSeededRng(config.seed);
  const sample = createSampler(config, rng);

  // 결과 수집 버퍼
  const allBalanceHistories: Float64Array[] = [];
  const finalBalances: number[] = [];
  const ruinYearHistogram = new Map<number, number>();
  const retirementBalances: number[] = [];

  let numSurvived = 0;
  const ruinYears: number[] = [];

  // ── N번 시뮬레이션 루프 ──────────────────────────────────────────────
  for (let i = 0; i < N; i++) {
    const returns = sample(totalYears);
    const result = simulateSinglePath(buildSimConfig(config, returns));

    allBalanceHistories.push(result.balanceHistory);
    retirementBalances.push(result.balanceAtRetirement);

    if (result.survived) {
      numSurvived++;
      finalBalances.push(result.finalBalance);
    } else {
      finalBalances.push(0);
      const ruinYear = result.ruinYear!;
      ruinYears.push(ruinYear);
      ruinYearHistogram.set(ruinYear, (ruinYearHistogram.get(ruinYear) ?? 0) + 1);
    }

    // 진행률 콜백 (100 단위로 호출)
    if (config.onProgress && (i + 1) % 100 === 0) {
      config.onProgress(i + 1, N);
    }
  }

  // ── 결과 집계 ─────────────────────────────────────────────────────────
  const survivalProbability = (numSurvived / N) * 100;

  const percentileTrajectories = computePercentileTrajectories(
    allBalanceHistories,
    totalYears
  );

  const finalBalanceDistribution = computeBalanceDistribution(finalBalances);

  const sortedRetirementBalances = [...retirementBalances].sort((a, b) => a - b);
  const medianBalanceAtRetirement = percentile(sortedRetirementBalances, 50);

  const medianRuinYear =
    ruinYears.length > 0
      ? percentile([...ruinYears].sort((a, b) => a - b), 50)
      : undefined;

  return {
    survivalProbability,
    numSimulations: N,
    numSurvived,
    numRuined: N - numSurvived,
    percentileTrajectories,
    finalBalanceDistribution,
    medianBalanceAtRetirement,
    ruinYearHistogram,
    medianRuinYear,
    config: {
      totalYears,
      samplingMethod: config.samplingMethod ?? "BOOTSTRAP",
      seed: config.seed,
    },
    elapsedMs: Date.now() - startTime,
  };
}

/**
 * 몬테카를로 시뮬레이션을 비동기적으로 실행합니다.
 *
 * 100회 배치 단위로 이벤트 루프에 제어권을 양보하여
 * 브라우저 UI가 블록되지 않습니다.
 *
 * @param config   - 몬테카를로 설정
 * @param batchSize - 배치 크기 (기본: 100, 낮을수록 UI 반응성 좋으나 느림)
 */
export async function runMonteCarloAsync(
  config: MonteCarloConfig,
  batchSize: number = 100
): Promise<MonteCarloResult> {
  const startTime = Date.now();
  const N = config.numSimulations ?? 10_000;
  const totalYears = config.accumulationYears + config.retirementYears;

  const rng = createSeededRng(config.seed);
  const sample = createSampler(config, rng);

  const allBalanceHistories: Float64Array[] = [];
  const finalBalances: number[] = [];
  const ruinYearHistogram = new Map<number, number>();
  const retirementBalances: number[] = [];
  let numSurvived = 0;
  const ruinYears: number[] = [];

  // ── 배치 처리 루프 ────────────────────────────────────────────────────
  for (let batchStart = 0; batchStart < N; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, N);

    for (let i = batchStart; i < batchEnd; i++) {
      const returns = sample(totalYears);
      const result = simulateSinglePath(buildSimConfig(config, returns));

      allBalanceHistories.push(result.balanceHistory);
      retirementBalances.push(result.balanceAtRetirement);

      if (result.survived) {
        numSurvived++;
        finalBalances.push(result.finalBalance);
      } else {
        finalBalances.push(0);
        const ruinYear = result.ruinYear!;
        ruinYears.push(ruinYear);
        ruinYearHistogram.set(ruinYear, (ruinYearHistogram.get(ruinYear) ?? 0) + 1);
      }
    }

    // 배치 완료 후 이벤트 루프에 제어권 양보
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    if (config.onProgress) {
      config.onProgress(batchEnd, N);
    }
  }

  const survivalProbability = (numSurvived / N) * 100;
  const percentileTrajectories = computePercentileTrajectories(
    allBalanceHistories,
    totalYears
  );
  const finalBalanceDistribution = computeBalanceDistribution(finalBalances);
  const sortedRetirementBalances = [...retirementBalances].sort((a, b) => a - b);
  const medianBalanceAtRetirement = percentile(sortedRetirementBalances, 50);
  const medianRuinYear =
    ruinYears.length > 0
      ? percentile([...ruinYears].sort((a, b) => a - b), 50)
      : undefined;

  return {
    survivalProbability,
    numSimulations: N,
    numSurvived,
    numRuined: N - numSurvived,
    percentileTrajectories,
    finalBalanceDistribution,
    medianBalanceAtRetirement,
    ruinYearHistogram,
    medianRuinYear,
    config: {
      totalYears,
      samplingMethod: config.samplingMethod ?? "BOOTSTRAP",
      seed: config.seed,
    },
    elapsedMs: Date.now() - startTime,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 결과 해석 유틸리티
// ─────────────────────────────────────────────────────────────────────

/**
 * 생존 확률에 따른 권고 등급을 반환합니다.
 * Financial Planning 업계의 일반적 기준을 따릅니다.
 */
export function interpretSurvivalProbability(probability: number): {
  grade: "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "RISKY" | "CRITICAL";
  label: string;
  recommendation: string;
} {
  if (probability >= 95) {
    return {
      grade: "EXCELLENT",
      label: "매우 안전",
      recommendation: "현재 계획이 매우 견고합니다. 유산 극대화나 조기 은퇴를 고려할 수 있습니다.",
    };
  }
  if (probability >= 85) {
    return {
      grade: "GOOD",
      label: "안전",
      recommendation: "양호한 수준입니다. 비상 자금을 추가로 준비하면 더욱 안정적입니다.",
    };
  }
  if (probability >= 75) {
    return {
      grade: "ACCEPTABLE",
      label: "허용 가능",
      recommendation: "개선이 필요합니다. 납입금 증가, 지출 감소, 또는 은퇴 연기를 검토하세요.",
    };
  }
  if (probability >= 60) {
    return {
      grade: "RISKY",
      label: "위험",
      recommendation: "상당한 파산 위험이 있습니다. 계획을 전면 재검토하세요.",
    };
  }
  return {
    grade: "CRITICAL",
    label: "매우 위험",
    recommendation: "현재 계획으로는 자산 고갈 가능성이 매우 높습니다. 즉각적인 조치가 필요합니다.",
  };
}

/**
 * 지속 가능한 인출율(Safe Withdrawal Rate) 역산.
 * 목표 생존 확률을 달성하는 초기 인출율을 이진 탐색으로 구합니다.
 *
 * @param baseConfig         - 몬테카를로 설정 (initialWithdrawalRate 제외)
 * @param targetProbability  - 목표 생존 확률 (기본: 95%)
 * @param tolerance          - 허용 오차 % (기본: 0.5%)
 * @param maxIterations      - 최대 반복 횟수 (기본: 20)
 */
export function findSafeWithdrawalRate(
  baseConfig: Omit<MonteCarloConfig, "initialWithdrawalRate">,
  targetProbability: number = 95,
  tolerance: number = 0.5,
  maxIterations: number = 20
): { safeRate: number; actualProbability: number } {
  let low = 0.01;   // 1%
  let high = 0.12;  // 12%
  let bestRate = low;
  let bestProb = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    const mid = (low + high) / 2;
    const result = runMonteCarlo({
      ...baseConfig,
      initialWithdrawalRate: mid,
      numSimulations: baseConfig.numSimulations ?? 2_000, // 탐색 중 빠른 실행
    });

    if (Math.abs(result.survivalProbability - targetProbability) < tolerance) {
      return { safeRate: mid, actualProbability: result.survivalProbability };
    }

    if (result.survivalProbability > targetProbability) {
      bestRate = mid;
      bestProb = result.survivalProbability;
      low = mid; // 생존 확률이 충분하면 인출률을 높여도 됨
    } else {
      high = mid; // 생존 확률이 부족하면 인출률을 낮춰야 함
    }
  }

  return { safeRate: bestRate, actualProbability: bestProb };
}
