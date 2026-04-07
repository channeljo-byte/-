import {
  simulateSinglePath,
  analyzeWithConstantReturn,
  findRequiredContribution,
  SimulationConfig,
} from "../portfolioSimulator";

/** 고정 수익률 배열을 생성하는 헬퍼 */
const makeReturns = (length: number, r: number) => Array(length).fill(r);

/** 기본 시뮬레이션 설정 (테스트용) */
const BASE_CONFIG: Omit<SimulationConfig, "annualReturns"> = {
  initialBalance: 100_000_000,     // 1억원
  annualContribution: 10_000_000,  // 연 1000만원
  accumulationYears: 20,
  retirementYears: 30,
  initialWithdrawalRate: 0.04,
  withdrawalStrategy: "CONSTANT_DOLLAR",
  inflationRate: 0.025,
};

describe("simulateSinglePath() — 단일 궤적 시뮬레이션", () => {
  // ── 적립기 검증 ──────────────────────────────────────────────────
  describe("적립기 (Accumulation Phase)", () => {
    it("0% 수익률에서 적립기: 초기자산 + 납입금 합계 = 은퇴 잔고", () => {
      // 0% 수익률: (초기 + 매년 납입) × (1+0)^n
      // 연 1000만원 납입, 20년, 인플레이션 0%, 수익률 0%
      const config: SimulationConfig = {
        ...BASE_CONFIG,
        inflationRate: 0,
        contributionGrowthRate: 0,
        annualReturns: makeReturns(50, 0),
      };
      const result = simulateSinglePath(config);
      // 초기 1억 + 연 1000만 × 20년 = 3억
      expect(result.balanceAtRetirement).toBeCloseTo(300_000_000, -4);
    });

    it("납입금이 인플레이션만큼 매년 증가한다", () => {
      const inflationRate = 0.03;
      const config: SimulationConfig = {
        ...BASE_CONFIG,
        initialBalance: 0,
        annualContribution: 10_000_000,
        inflationRate,
        contributionGrowthRate: inflationRate,
        annualReturns: makeReturns(50, 0), // 수익률 0%로 납입금 효과만 분리
      };
      const result = simulateSinglePath(config, true);
      const snapshots = result.snapshots!;

      // 1년차 납입금: 1000만원
      expect(snapshots[0].contribution).toBeCloseTo(10_000_000, -2);
      // 2년차 납입금: 1000만 × 1.03
      expect(snapshots[1].contribution).toBeCloseTo(10_300_000, -2);
      // 3년차 납입금: 1000만 × 1.03^2
      expect(snapshots[2].contribution).toBeCloseTo(10_609_000, -2);
    });

    it("복리 수익률이 잔고에 정확히 반영된다", () => {
      const r = 0.10;
      const config: SimulationConfig = {
        initialBalance: 100_000_000,
        annualContribution: 0,       // 납입 없음
        accumulationYears: 5,
        retirementYears: 1,
        initialWithdrawalRate: 0.04,
        withdrawalStrategy: "CONSTANT_DOLLAR",
        inflationRate: 0,
        annualReturns: makeReturns(6, r),
      };
      const result = simulateSinglePath(config);
      // 1억 × 1.1^5 = 161,051,000
      expect(result.balanceAtRetirement).toBeCloseTo(161_051_000, -2);
    });
  });

  // ── 인출기 — CONSTANT_DOLLAR (4% 룰) ────────────────────────────
  describe("인출기 — CONSTANT_DOLLAR (4% 룰)", () => {
    it("매우 높은 수익률(30%)에서 반드시 생존한다", () => {
      const result = simulateSinglePath({
        ...BASE_CONFIG,
        annualReturns: makeReturns(50, 0.30),
      });
      expect(result.survived).toBe(true);
      expect(result.finalBalance).toBeGreaterThan(0);
    });

    it("매우 낮은 수익률(-30%)에서 조기 파산한다", () => {
      const result = simulateSinglePath({
        ...BASE_CONFIG,
        annualReturns: makeReturns(50, -0.30),
      });
      expect(result.survived).toBe(false);
      expect(result.ruinYear).toBeDefined();
      expect(result.finalBalance).toBe(0);
    });

    it("4% 인출 + 5% 실질 수익률에서 30년 생존한다 (Bengen 검증)", () => {
      // 실질 수익률 5%는 통상적으로 30년 생존 가능
      const realReturn = 0.05;
      const inflation = 0.025;
      // 명목 수익률: (1.05 × 1.025) - 1 = 7.625%
      const nominalReturn = (1 + realReturn) * (1 + inflation) - 1;

      const result = simulateSinglePath({
        ...BASE_CONFIG,
        accumulationYears: 0, // 이미 은퇴 상태
        retirementYears: 30,
        initialBalance: 1_000_000_000, // 10억 (납입 없이 바로 인출기)
        annualContribution: 0,
        inflationRate: inflation,
        annualReturns: makeReturns(30, nominalReturn),
      });
      expect(result.survived).toBe(true);
    });

    it("인출 후 잔고가 0 이하가 되는 즉시 파산 처리", () => {
      const config: SimulationConfig = {
        initialBalance: 10_000_000,  // 1000만원
        annualContribution: 0,
        accumulationYears: 0,
        retirementYears: 10,
        initialWithdrawalRate: 0.50, // 50% 인출 → 빠른 소진
        withdrawalStrategy: "CONSTANT_DOLLAR",
        inflationRate: 0,
        annualReturns: makeReturns(10, 0),
      };
      const result = simulateSinglePath(config);
      expect(result.survived).toBe(false);
      expect(result.ruinYear).toBeDefined();
    });

    it("파산 시 finalBalance = 0", () => {
      const result = simulateSinglePath({
        ...BASE_CONFIG,
        annualReturns: makeReturns(50, -0.50),
      });
      expect(result.finalBalance).toBe(0);
    });
  });

  // ── 인출기 — CONSTANT_PERCENTAGE ───────────────────────────────
  describe("인출기 — CONSTANT_PERCENTAGE", () => {
    it("어떤 수익률에서도 파산하지 않는다 (절대 0 이하 불가)", () => {
      const config: SimulationConfig = {
        ...BASE_CONFIG,
        withdrawalStrategy: "CONSTANT_PERCENTAGE",
        annualReturns: makeReturns(50, -0.20), // 매년 -20% 손실
      };
      const result = simulateSinglePath(config);
      // 현재 잔고의 4%를 인출하므로 잔고가 0이 되려면 수익률이 -100%여야 함
      // -20%에서는 잔고가 줄지만 파산하지 않음
      expect(result.survived).toBe(true);
    });
  });

  // ── 인출기 — DYNAMIC_GUARDRAILS ─────────────────────────────────
  describe("인출기 — DYNAMIC_GUARDRAILS (Guyton-Klinger)", () => {
    it("하락장에서 인출금을 자동으로 감소시킨다", () => {
      const config: SimulationConfig = {
        initialBalance: 1_000_000_000,
        annualContribution: 0,
        accumulationYears: 0,
        retirementYears: 5,
        initialWithdrawalRate: 0.04,
        withdrawalStrategy: "DYNAMIC_GUARDRAILS",
        inflationRate: 0.02,
        annualReturns: makeReturns(5, -0.25), // 극단적 하락
      };
      const result = simulateSinglePath(config, true);
      const snapshots = result.snapshots!;

      // 하락장에서 인출률이 높아지면 가드레일이 작동하여 인출금 감소
      // -25% 수익률에서도 가드레일 덕분에 5년간 생존 가능
      expect(result.survived).toBe(true);
      expect(snapshots.length).toBeGreaterThan(0);

      // 가드레일 효과: 2년차 이후 인출금이 단순 인플레이션 조정액보다 낮아야 함
      // (수익률 하락으로 인출률이 120% 임계값 초과 → 인출금 10% 감소 적용)
      const firstWithdrawal = snapshots[0].withdrawal;
      const simpleInflationAdjusted = firstWithdrawal * (1 + 0.02);
      if (snapshots.length > 1) {
        // 가드레일이 작동하면 실제 인출금 ≤ 단순 인플레이션 조정액
        expect(snapshots[1].withdrawal).toBeLessThanOrEqual(simpleInflationAdjusted * 1.001);
      }
    });
  });

  // ── 인출기 — VPW ────────────────────────────────────────────────
  describe("인출기 — VPW (Variable Percentage Withdrawal)", () => {
    it("0% 수익률, 30년 = 매년 잔고/잔여기간 균등 인출", () => {
      const config: SimulationConfig = {
        initialBalance: 300_000_000,
        annualContribution: 0,
        accumulationYears: 0,
        retirementYears: 30,
        initialWithdrawalRate: 0.04, // VPW에서는 참고값
        withdrawalStrategy: "VPW",
        inflationRate: 0,
        annualReturns: makeReturns(30, 0),
      };
      const result = simulateSinglePath(config, true);
      // VPW: 첫 해 인출 = 300M/30 = 10M
      expect(result.snapshots![0].withdrawal).toBeCloseTo(10_000_000, -3);
      expect(result.survived).toBe(true);
    });
  });

  // ── balanceHistory 검증 ─────────────────────────────────────────
  describe("balanceHistory (연도별 잔고 기록)", () => {
    it("balanceHistory[0]이 초기 자산과 일치한다", () => {
      const config: SimulationConfig = {
        ...BASE_CONFIG,
        annualReturns: makeReturns(50, 0.07),
      };
      const result = simulateSinglePath(config);
      expect(result.balanceHistory[0]).toBe(100_000_000);
    });

    it("balanceHistory 길이 = totalYears + 1 (0년차 포함)", () => {
      const result = simulateSinglePath({
        ...BASE_CONFIG,
        annualReturns: makeReturns(50, 0.07),
      });
      expect(result.balanceHistory.length).toBe(51); // 20 + 30 + 1
    });
  });

  // ── 필요 납입금 역산 ────────────────────────────────────────────
  describe("findRequiredContribution()", () => {
    it("목표 자산 5억 달성에 필요한 연 납입금을 계산한다", () => {
      const target = 500_000_000;
      const required = findRequiredContribution(
        target,
        {
          initialBalance: 50_000_000,
          accumulationYears: 20,
          retirementYears: 30,
          initialWithdrawalRate: 0.04,
          withdrawalStrategy: "CONSTANT_DOLLAR",
          inflationRate: 0,
          contributionGrowthRate: 0,
        },
        0.07
      );
      // 검증: 계산된 납입금으로 실제 시뮬레이션 시 ≈ 5억
      const returns = makeReturns(50, 0.07);
      const result = simulateSinglePath({
        initialBalance: 50_000_000,
        annualContribution: required,
        accumulationYears: 20,
        retirementYears: 30,
        initialWithdrawalRate: 0.04,
        withdrawalStrategy: "CONSTANT_DOLLAR",
        inflationRate: 0,
        contributionGrowthRate: 0,
        annualReturns: returns,
      });
      expect(Math.abs(result.balanceAtRetirement - target)).toBeLessThan(100_000); // 10만원 이내
    });
  });
});
