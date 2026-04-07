/**
 * Simulation Engine — 공개 API
 *
 * 사용 예시:
 *   import { runMonteCarlo, RETURN_PRESETS, realReturn } from "@/lib/simulation";
 */

// 피셔 방정식
export {
  realReturn,
  nominalReturn,
  realReturnApprox,
  fisherApproxError,
  toRealReturnSeries,
  computeReturnStatistics,
  analyzeRealReturns,
  purchasingPowerDecay,
  inflationAdjustedAmount,
  yearsToHalvePurchasingPower,
} from "./fisherEquation";
export type { ReturnStatistics } from "./fisherEquation";

// 과거 수익률 데이터
export {
  SP500_ANNUAL_RETURNS,
  SP500_YEARS,
  KOSPI_ANNUAL_RETURNS,
  KR_BOND_RETURNS,
  RETURN_PRESETS,
  blendPortfolioReturns,
  bootstrapSample,
  blockBootstrapSample,
  parametricSample,
  createSeededRng,
} from "./historicalReturns";
export type { PortfolioBlend } from "./historicalReturns";

// 포트폴리오 시뮬레이터
export {
  simulateSinglePath,
  analyzeWithConstantReturn,
  analyzeScenarios,
  findRequiredContribution,
} from "./portfolioSimulator";
export type {
  WithdrawalStrategy,
  SimulationConfig,
  YearlySnapshot,
  SimulationResult,
} from "./portfolioSimulator";

// 몬테카를로 엔진
export {
  runMonteCarlo,
  runMonteCarloAsync,
  interpretSurvivalProbability,
  findSafeWithdrawalRate,
} from "./monteCarlo";
export type {
  SamplingMethod,
  MonteCarloConfig,
  PercentileTrajectories,
  BalanceDistribution,
  MonteCarloResult,
} from "./monteCarlo";
