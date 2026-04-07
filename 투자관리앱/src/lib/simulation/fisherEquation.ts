/**
 * fisherEquation.ts — 피셔 방정식(Fisher Equation) 기반 실질 수익률 도출
 *
 * ─── 피셔 방정식이란? ────────────────────────────────────────────────
 * 어빙 피셔(Irving Fisher, 1930)가 제시한 명목 수익률과 실질 수익률의 관계:
 *
 *   (1 + r_real) = (1 + r_nominal) / (1 + r_inflation)
 *
 * 단순 근사식(r_real ≈ r_nominal - r_inflation)은 인플레이션이 높을수록
 * 오차가 커집니다. 이 모듈은 항상 정확한 공식을 사용합니다.
 *
 * 예시: 명목 수익률 8%, 인플레이션 3%
 *   근사:  8% - 3% = 5.00%
 *   정확:  (1.08 / 1.03) - 1 = 4.854%  ← 14.6bp 오차
 *
 * 장기 은퇴 시뮬레이션에서 이 오차는 수천만 원 단위의 차이로 누적됩니다.
 * ─────────────────────────────────────────────────────────────────────
 */

// ─────────────────────────────────────────────────────────────────────
// 기본 변환 함수
// ─────────────────────────────────────────────────────────────────────

/**
 * 명목 수익률에서 실질 수익률을 도출합니다.
 *
 * 공식: r_real = (1 + r_nominal) / (1 + r_inflation) - 1
 *
 * @param nominalReturn   - 명목 수익률 (소수, 예: 0.08 = 8%)
 * @param inflationRate   - 인플레이션율 (소수, 예: 0.03 = 3%)
 * @returns               - 실질 수익률 (소수)
 *
 * @example
 * realReturn(0.08, 0.03)  // → 0.04854... (약 4.85%)
 * realReturn(0.05, 0.025) // → 0.02439... (약 2.44%)
 */
export function realReturn(
  nominalReturn: number,
  inflationRate: number
): number {
  if (inflationRate <= -1) {
    throw new RangeError(
      `인플레이션율이 -100% 이하입니다: ${inflationRate * 100}%`
    );
  }
  return (1 + nominalReturn) / (1 + inflationRate) - 1;
}

/**
 * 목표 실질 수익률을 달성하기 위한 명목 수익률을 계산합니다.
 * (피셔 방정식 역산)
 *
 * 공식: r_nominal = (1 + r_real) × (1 + r_inflation) - 1
 *
 * @param targetRealReturn - 목표 실질 수익률 (소수)
 * @param inflationRate    - 인플레이션율 (소수)
 * @returns                - 필요 명목 수익률 (소수)
 *
 * @example
 * // 실질 5% 달성을 위해 3% 인플레이션 환경에서는 몇 % 명목 수익률 필요?
 * nominalReturn(0.05, 0.03) // → 0.0815 (8.15%)
 */
export function nominalReturn(
  targetRealReturn: number,
  inflationRate: number
): number {
  return (1 + targetRealReturn) * (1 + inflationRate) - 1;
}

/**
 * 근사 실질 수익률 (단순 차감법)
 * 교육 목적 또는 정확한 피셔 방정식과의 비교용.
 * 실제 계산에는 realReturn()을 사용하세요.
 */
export function realReturnApprox(
  nominalReturn: number,
  inflationRate: number
): number {
  return nominalReturn - inflationRate;
}

/**
 * 정확한 피셔 방정식과 근사식의 오차(basis points)를 반환합니다.
 * 오차 분석용 유틸리티.
 */
export function fisherApproxError(
  nominalReturn: number,
  inflationRate: number
): number {
  const exact = realReturn(nominalReturn, inflationRate);
  const approx = realReturnApprox(nominalReturn, inflationRate);
  return (approx - exact) * 10_000; // basis points
}

// ─────────────────────────────────────────────────────────────────────
// 시계열 변환
// ─────────────────────────────────────────────────────────────────────

/**
 * 명목 수익률 배열 전체를 실질 수익률 배열로 변환합니다.
 * 각 연도의 인플레이션이 다른 경우, 배열로 제공할 수 있습니다.
 *
 * @param nominalReturns  - 연도별 명목 수익률 배열
 * @param inflationRates  - 연도별 인플레이션율 (단일 값이면 모든 연도에 적용)
 * @returns               - 연도별 실질 수익률 배열
 *
 * @example
 * toRealReturnSeries([0.08, -0.03, 0.12], 0.03)
 * // → [0.04854, -0.05825, 0.08738]
 */
export function toRealReturnSeries(
  nominalReturns: number[],
  inflationRates: number | number[]
): number[] {
  const isArray = Array.isArray(inflationRates);
  if (isArray && inflationRates.length !== nominalReturns.length) {
    throw new RangeError(
      `수익률 배열(${nominalReturns.length})과 인플레이션 배열(${inflationRates.length})의 길이가 다릅니다.`
    );
  }
  return nominalReturns.map((r, i) => {
    const inf = isArray ? inflationRates[i] : inflationRates;
    return realReturn(r, inf);
  });
}

// ─────────────────────────────────────────────────────────────────────
// 통계 분석
// ─────────────────────────────────────────────────────────────────────

export interface ReturnStatistics {
  /** 산술 평균 수익률 */
  arithmeticMean: number;
  /** 기하 평균 수익률 (복리 연환산 수익률 = CAGR) */
  geometricMean: number;
  /** 표준편차 (변동성) */
  stdDev: number;
  /** 중앙값 */
  median: number;
  /** 최소값 */
  min: number;
  /** 최대값 */
  max: number;
  /** 샤프 비율 근사 (무위험 수익률 = 0 기준) */
  sharpeRatio: number;
  /** 음의 수익률 연도 비율 */
  negativeYearRate: number;
}

/**
 * 수익률 배열의 통계 지표를 계산합니다.
 * 명목 또는 실질 수익률 배열 모두에 사용 가능합니다.
 *
 * @param returns - 연도별 수익률 배열 (소수)
 */
export function computeReturnStatistics(returns: number[]): ReturnStatistics {
  if (returns.length === 0) {
    throw new RangeError("수익률 배열이 비어있습니다.");
  }

  const n = returns.length;

  // 산술 평균
  const arithmeticMean = returns.reduce((s, r) => s + r, 0) / n;

  // 기하 평균 (복리 연환산)
  const geometricMean =
    Math.pow(
      returns.reduce((prod, r) => prod * (1 + r), 1),
      1 / n
    ) - 1;

  // 표준편차
  const variance =
    returns.reduce((s, r) => s + Math.pow(r - arithmeticMean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  // 중앙값
  const sorted = [...returns].sort((a, b) => a - b);
  const median =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];

  // 샤프 비율 (무위험 수익률 = 0 기준 근사)
  const sharpeRatio = stdDev > 0 ? arithmeticMean / stdDev : 0;

  // 음의 수익률 비율
  const negativeYears = returns.filter((r) => r < 0).length;
  const negativeYearRate = negativeYears / n;

  return {
    arithmeticMean,
    geometricMean,
    stdDev,
    median,
    min: sorted[0],
    max: sorted[n - 1],
    sharpeRatio,
    negativeYearRate,
  };
}

/**
 * 명목 수익률 배열을 실질 수익률로 변환하고 통계를 반환합니다.
 * 포트폴리오의 실질 성과 분석에 사용합니다.
 */
export function analyzeRealReturns(
  nominalReturns: number[],
  inflationRate: number
): { realReturns: number[]; statistics: ReturnStatistics } {
  const realReturns = toRealReturnSeries(nominalReturns, inflationRate);
  const statistics = computeReturnStatistics(realReturns);
  return { realReturns, statistics };
}

// ─────────────────────────────────────────────────────────────────────
// 구매력(Purchasing Power) 계산
// ─────────────────────────────────────────────────────────────────────

/**
 * 현재 금액의 N년 후 실질 구매력을 계산합니다.
 *
 * @param amount       - 현재 금액 (원)
 * @param inflationRate - 연간 인플레이션율
 * @param years        - 기간 (년)
 * @returns            - N년 후 동일 구매력에 해당하는 현재 가치
 *
 * @example
 * // 2% 인플레이션에서 1억원은 30년 후 실질 가치?
 * purchasingPowerDecay(100_000_000, 0.02, 30) // → 55,207,368원 (약 55.2%)
 */
export function purchasingPowerDecay(
  amount: number,
  inflationRate: number,
  years: number
): number {
  return amount / Math.pow(1 + inflationRate, years);
}

/**
 * 현재 금액을 N년 후의 명목 금액으로 환산합니다. (인플레이션 조정 납입금 계산 등)
 *
 * @example
 * // 현재 월 100만원 적립금, 3% 인플레이션에서 10년 후 동일 실질 가치 유지하려면?
 * inflationAdjustedAmount(1_000_000, 0.03, 10) // → 1,343,916원
 */
export function inflationAdjustedAmount(
  amount: number,
  inflationRate: number,
  years: number
): number {
  return amount * Math.pow(1 + inflationRate, years);
}

/**
 * 인플레이션을 고려한 '72의 법칙' — 구매력이 반감되는 데 걸리는 기간.
 *
 * @example
 * yearsToHalvePurchasingPower(0.03) // → 23.4년 (정확값)
 */
export function yearsToHalvePurchasingPower(inflationRate: number): number {
  if (inflationRate <= 0) {
    throw new RangeError("인플레이션율은 양수여야 합니다.");
  }
  return Math.log(2) / Math.log(1 + inflationRate);
}
