/**
 * portfolioSimulator.ts — 단일 은퇴 궤적 시뮬레이션
 *
 * ─── 생애 주기 2단계 모델 ────────────────────────────────────────────
 *
 * [적립기 (Accumulation Phase)]
 * 은퇴 전까지 매년 납입금을 추가하고 시장 수익률을 적용합니다.
 * 납입금은 인플레이션만큼 매년 인상됩니다 (실질 납입력 유지).
 *
 * [인출기 (Distribution/Decumulation Phase)]
 * 은퇴 후 생활비를 인출하면서 남은 자산이 목표 수명까지 지속되는지 확인합니다.
 *
 * ─── 인출 전략 ───────────────────────────────────────────────────────
 *
 * CONSTANT_DOLLAR (4% 룰, Bengen 1994):
 *   - 은퇴 시 자산의 4%(또는 지정 비율)를 연간 기준 인출금으로 설정
 *   - 매년 전년도 인출금에 인플레이션 적용 (실질 소비 유지)
 *   - 단순하고 검증된 방법, 보수적 설계
 *
 * CONSTANT_PERCENTAGE:
 *   - 매년 현재 자산의 고정 비율 인출
 *   - 절대 파산하지 않으나, 하락장에서 인출금이 급감
 *
 * DYNAMIC_GUARDRAILS (Guyton-Klinger, 2006):
 *   - 인출률이 초기 대비 120% 초과 시 10% 감소 (하방 방어)
 *   - 인출률이 초기 대비 80% 미만 시 10% 증가 (생활 개선)
 *   - 포트폴리오 상황에 따라 탄력적으로 조정
 *
 * VPW (Variable Percentage Withdrawal):
 *   - 잔여 수명 기반 인출: withdrawal = balance / remainingYears
 *   - 자산이 남는 한 항상 뭔가를 인출, 파산 없음
 *   - 후기에 인출금 급감 가능
 * ─────────────────────────────────────────────────────────────────────
 */

// ─────────────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────────────

export type WithdrawalStrategy =
  | "CONSTANT_DOLLAR"      // 4% 룰 (인플레이션 조정)
  | "CONSTANT_PERCENTAGE"  // 현재 잔고의 고정 비율
  | "DYNAMIC_GUARDRAILS"   // Guyton-Klinger 가드레일
  | "VPW";                 // 잔여 기간 기반 변동 인출

/**
 * 단일 시뮬레이션 설정
 */
export interface SimulationConfig {
  /** 시뮬레이션 시작 시점 자산 총액 (원) */
  initialBalance: number;

  /** ─── 적립기 설정 ─── */
  /** 연간 납입금 (원, 현재 가치 기준 — 시뮬레이션이 인플레이션 조정) */
  annualContribution: number;
  /** 적립 기간 (년, 현재부터 은퇴까지) */
  accumulationYears: number;
  /**
   * 납입금 연간 인상률 (기본: inflationRate와 동일하여 실질 납입력 유지)
   * 별도 지정 시: 예) 연봉 상승률 0.05 (5%)
   */
  contributionGrowthRate?: number;

  /** ─── 인출기 설정 ─── */
  /** 은퇴 후 목표 생존 기간 (년, 예: 목표 수명 90세 - 은퇴 60세 = 30년) */
  retirementYears: number;
  /**
   * 연간 초기 인출률 (4% 룰 기준: 0.04)
   * CONSTANT_DOLLAR/DYNAMIC_GUARDRAILS에서 은퇴 첫 해 잔고에 적용
   */
  initialWithdrawalRate: number;
  /** 인출 전략 */
  withdrawalStrategy: WithdrawalStrategy;

  /** ─── 공통 설정 ─── */
  /** 연간 인플레이션율 (예: 0.025 = 2.5%) */
  inflationRate: number;

  /**
   * 연도별 수익률 배열. 길이는 accumulationYears + retirementYears 이상이어야 합니다.
   * 몬테카를로 엔진이 Bootstrap 샘플을 주입합니다.
   */
  annualReturns: number[];
}

/**
 * 단일 시뮬레이션 연도별 스냅샷
 */
export interface YearlySnapshot {
  year: number;        // 절대 연도 번호 (1부터 시작)
  phase: "accumulation" | "retirement";
  balance: number;     // 해당 연도 말 잔고
  return: number;      // 해당 연도 수익률
  contribution: number; // 납입액 (적립기) 또는 0 (인출기)
  withdrawal: number;  // 인출액 (인출기) 또는 0 (적립기)
  realBalance: number; // 현재 가치 기준 실질 잔고 (인플레이션 차감)
}

/**
 * 단일 시뮬레이션 결과
 */
export interface SimulationResult {
  /** 목표 기간 동안 자산이 유지되었는지 여부 */
  survived: boolean;
  /** 시뮬레이션 종료 시 잔고 (0이면 파산, 양수이면 유산) */
  finalBalance: number;
  /** 은퇴 시점 자산 (적립기 완료 후) */
  balanceAtRetirement: number;
  /** 파산 연도 (생존 시 undefined) */
  ruinYear?: number;
  /** 연도별 잔고 배열 (몬테카를로 집계용 경량 버전) */
  balanceHistory: Float64Array;
  /** 상세 스냅샷 (선택적, 단일 시뮬레이션 분석 시 사용) */
  snapshots?: YearlySnapshot[];
}

// ─────────────────────────────────────────────────────────────────────
// 인출 전략 구현
// ─────────────────────────────────────────────────────────────────────

interface WithdrawalContext {
  currentBalance: number;
  initialWithdrawal: number;  // 첫 해 기준 인출금 (CONSTANT_DOLLAR)
  prevWithdrawal: number;     // 전년도 실제 인출금
  remainingYears: number;
  yearInRetirement: number;   // 은퇴 후 몇 년째 (1부터)
  inflationRate: number;
  initialWithdrawalRate: number;
  initialRetirementBalance: number; // 은퇴 첫날 자산
}

/**
 * 인출 전략에 따라 해당 연도 인출금을 결정합니다.
 * 실제 인출은 portfolioSimulator 루프에서 수행합니다.
 */
function calculateWithdrawal(
  strategy: WithdrawalStrategy,
  ctx: WithdrawalContext
): number {
  switch (strategy) {
    case "CONSTANT_DOLLAR": {
      // 첫 해 인출금을 매년 인플레이션 조정
      return ctx.prevWithdrawal * (1 + ctx.inflationRate);
    }

    case "CONSTANT_PERCENTAGE": {
      // 현재 잔고의 고정 비율
      return ctx.currentBalance * ctx.initialWithdrawalRate;
    }

    case "DYNAMIC_GUARDRAILS": {
      // Guyton-Klinger: 인플레이션 조정 기본값에 가드레일 적용
      const baseWithdrawal = ctx.prevWithdrawal * (1 + ctx.inflationRate);
      const currentRate = baseWithdrawal / ctx.currentBalance;

      // 상한 가드레일: 인출률이 초기의 120% 초과 시 10% 감소
      if (currentRate > ctx.initialWithdrawalRate * 1.2) {
        return baseWithdrawal * 0.9;
      }

      // 하한 가드레일: 인출률이 초기의 80% 미만 시 10% 증가
      if (currentRate < ctx.initialWithdrawalRate * 0.8) {
        return baseWithdrawal * 1.1;
      }

      return baseWithdrawal;
    }

    case "VPW": {
      // Variable Percentage Withdrawal: 잔여 기간 균등 분할
      if (ctx.remainingYears <= 0) return ctx.currentBalance;
      return ctx.currentBalance / ctx.remainingYears;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// 메인 시뮬레이션 함수
// ─────────────────────────────────────────────────────────────────────

/**
 * 단일 은퇴 궤적을 시뮬레이션합니다.
 *
 * @param config          - 시뮬레이션 설정
 * @param captureSnapshots - 연도별 상세 스냅샷 캡처 여부 (기본: false, 성능 우선)
 * @returns               - 시뮬레이션 결과
 *
 * @example
 * const result = simulateSinglePath({
 *   initialBalance: 100_000_000,     // 1억원
 *   annualContribution: 12_000_000,  // 연 1200만원
 *   accumulationYears: 20,           // 20년 적립
 *   retirementYears: 30,             // 30년 인출
 *   initialWithdrawalRate: 0.04,     // 4% 룰
 *   withdrawalStrategy: "CONSTANT_DOLLAR",
 *   inflationRate: 0.025,            // 2.5% 인플레이션
 *   annualReturns: [...],            // 50년치 수익률
 * });
 */
export function simulateSinglePath(
  config: SimulationConfig,
  captureSnapshots: boolean = false
): SimulationResult {
  const {
    initialBalance,
    annualContribution,
    accumulationYears,
    retirementYears,
    initialWithdrawalRate,
    withdrawalStrategy,
    inflationRate,
    annualReturns,
  } = config;

  const totalYears = accumulationYears + retirementYears;
  const contributionGrowthRate = config.contributionGrowthRate ?? inflationRate;

  if (annualReturns.length < totalYears) {
    throw new RangeError(
      `수익률 배열 길이(${annualReturns.length})가 총 시뮬레이션 기간(${totalYears})보다 짧습니다.`
    );
  }

  // 연도별 잔고 기록 (Float64Array로 메모리 최적화)
  const balanceHistory = new Float64Array(totalYears + 1);
  balanceHistory[0] = initialBalance;

  const snapshots: YearlySnapshot[] = captureSnapshots ? [] : (undefined as any);
  let balance = initialBalance;

  // ── 적립기 (Accumulation Phase) ─────────────────────────────────────
  for (let y = 0; y < accumulationYears; y++) {
    const annualReturn = annualReturns[y];
    // 납입금 인플레이션/연봉 상승 조정 (실질 납입력 유지)
    const contribution = annualContribution * Math.pow(1 + contributionGrowthRate, y);

    // 연초 납입 후 수익률 적용 (보수적 가정)
    balance = (balance + contribution) * (1 + annualReturn);

    balanceHistory[y + 1] = balance;

    if (captureSnapshots) {
      snapshots.push({
        year: y + 1,
        phase: "accumulation",
        balance,
        return: annualReturn,
        contribution,
        withdrawal: 0,
        realBalance: balance / Math.pow(1 + inflationRate, y + 1),
      });
    }
  }

  const balanceAtRetirement = balance;

  // ── 인출기 (Distribution/Decumulation Phase) ─────────────────────────
  // 첫 해 인출금 설정 (전략마다 첫 해 계산 방식이 다름)
  let withdrawal: number;
  if (withdrawalStrategy === "VPW") {
    // VPW: 잔여 기간 기반 — 첫 해부터 balance / retirementYears
    withdrawal = retirementYears > 0 ? balance / retirementYears : balance;
  } else {
    // CONSTANT_DOLLAR / CONSTANT_PERCENTAGE / DYNAMIC_GUARDRAILS: 초기 잔고 × 인출률
    withdrawal = balance * initialWithdrawalRate;
  }

  for (let y = 0; y < retirementYears; y++) {
    const yearIndex = accumulationYears + y;
    const annualReturn = annualReturns[yearIndex];
    const yearInRetirement = y + 1;

    if (y > 0) {
      // 2년차부터 전략에 따라 인출금 재계산
      withdrawal = calculateWithdrawal(withdrawalStrategy, {
        currentBalance: balance,
        initialWithdrawal: balanceAtRetirement * initialWithdrawalRate,
        prevWithdrawal: withdrawal,
        remainingYears: retirementYears - y,
        yearInRetirement,
        inflationRate,
        initialWithdrawalRate,
        initialRetirementBalance: balanceAtRetirement,
      });
    }

    // 인출은 연초에 실행 (보수적: 최악의 경우 먼저 고려)
    balance -= withdrawal;

    if (balance < 0) {
      // 파산: 해당 연도에 자산이 음수가 됨 (정확히 0이 되는 것은 완전 소진, 생존으로 처리)
      const ruinYear = accumulationYears + y + 1;
      balanceHistory[yearIndex + 1] = 0;

      return {
        survived: false,
        finalBalance: 0,
        balanceAtRetirement,
        ruinYear,
        balanceHistory,
        snapshots: captureSnapshots ? snapshots : undefined,
      };
    }

    // 잔여 자산에 수익률 적용 (연말 평가)
    balance *= 1 + annualReturn;
    balanceHistory[yearIndex + 1] = balance;

    if (captureSnapshots) {
      const totalYearsElapsed = accumulationYears + y + 1;
      snapshots.push({
        year: totalYearsElapsed,
        phase: "retirement",
        balance,
        return: annualReturn,
        contribution: 0,
        withdrawal,
        realBalance: balance / Math.pow(1 + inflationRate, totalYearsElapsed),
      });
    }
  }

  return {
    survived: true,
    finalBalance: balance,
    balanceAtRetirement,
    ruinYear: undefined,
    balanceHistory,
    snapshots: captureSnapshots ? snapshots : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 결정론적 분석 도우미
// ─────────────────────────────────────────────────────────────────────

/**
 * 고정 수익률로 은퇴 궤적을 분석합니다.
 * 낙관/기대/비관 시나리오 비교에 사용합니다.
 *
 * @param config        - 시뮬레이션 설정 (annualReturns 제외)
 * @param constantReturn - 매년 동일하게 적용할 수익률
 */
export function analyzeWithConstantReturn(
  config: Omit<SimulationConfig, "annualReturns">,
  constantReturn: number
): SimulationResult {
  const totalYears = config.accumulationYears + config.retirementYears;
  return simulateSinglePath(
    {
      ...config,
      annualReturns: Array(totalYears).fill(constantReturn),
    },
    true // 상세 스냅샷 포함
  );
}

/**
 * 여러 시나리오(낙관/기대/비관)를 한 번에 분석합니다.
 */
export function analyzeScenarios(
  config: Omit<SimulationConfig, "annualReturns">,
  scenarios: { label: string; constantReturn: number }[]
): Record<string, SimulationResult> {
  return Object.fromEntries(
    scenarios.map(({ label, constantReturn }) => [
      label,
      analyzeWithConstantReturn(config, constantReturn),
    ])
  );
}

/**
 * 목표 자산을 달성하기 위한 필요 연간 납입금을 계산합니다.
 * 이진 탐색으로 구합니다.
 *
 * @param targetBalance   - 은퇴 시 목표 자산 (원)
 * @param config          - 시뮬레이션 설정 (annualContribution, annualReturns 제외)
 * @param constantReturn  - 분석에 사용할 고정 수익률
 * @param tolerance       - 허용 오차 (원, 기본: 10,000원)
 */
export function findRequiredContribution(
  targetBalance: number,
  config: Omit<SimulationConfig, "annualContribution" | "annualReturns">,
  constantReturn: number,
  tolerance: number = 10_000
): number {
  const totalYears = config.accumulationYears + config.retirementYears;
  const returns = Array(totalYears).fill(constantReturn);

  let low = 0;
  let high = targetBalance; // 최대 납입금 상한

  for (let iteration = 0; iteration < 60; iteration++) {
    const mid = (low + high) / 2;
    const result = simulateSinglePath({ ...config, annualContribution: mid, annualReturns: returns });

    if (Math.abs(result.balanceAtRetirement - targetBalance) < tolerance) {
      return mid;
    }

    if (result.balanceAtRetirement < targetBalance) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}
