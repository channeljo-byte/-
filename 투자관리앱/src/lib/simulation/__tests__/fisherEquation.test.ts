import {
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
} from "../fisherEquation";

describe("Fisher Equation — 피셔 방정식", () => {
  // ── 기본 변환 ──────────────────────────────────────────────────────
  describe("realReturn()", () => {
    it("명목 8%, 인플레이션 3% → 실질 약 4.85%", () => {
      const result = realReturn(0.08, 0.03);
      // (1.08 / 1.03) - 1 = 0.048543...
      expect(result).toBeCloseTo(0.048543, 4);
    });

    it("명목 = 인플레이션이면 실질 수익률 = 0", () => {
      expect(realReturn(0.05, 0.05)).toBeCloseTo(0, 10);
    });

    it("명목 수익률이 인플레이션보다 낮으면 실질 수익률은 음수", () => {
      expect(realReturn(0.02, 0.05)).toBeLessThan(0);
    });

    it("명목 수익률 0%, 인플레이션 2% → 실질 -1.96%", () => {
      // (1.00 / 1.02) - 1 = -0.019607...
      expect(realReturn(0.0, 0.02)).toBeCloseTo(-0.019608, 4);
    });

    it("큰 인플레이션(50%)에서도 정확히 계산", () => {
      // (1.60 / 1.50) - 1 = 0.06666...
      expect(realReturn(0.60, 0.50)).toBeCloseTo(0.06667, 4);
    });

    it("인플레이션 -100% 이하는 RangeError", () => {
      expect(() => realReturn(0.05, -1.0)).toThrow(RangeError);
      expect(() => realReturn(0.05, -1.5)).toThrow(RangeError);
    });
  });

  // ── 근사식 오차 검증 ────────────────────────────────────────────────
  describe("근사식(r_nominal - r_inflation) vs 정확한 피셔 방정식", () => {
    it("낮은 인플레이션(1%)에서 오차는 작음 (<10bp) — 실제값 약 6.93bp", () => {
      const error = fisherApproxError(0.08, 0.01);
      // (1.08/1.01) - 1 = 6.9307%, 근사 7%, 오차 = 6.93bp
      expect(Math.abs(error)).toBeCloseTo(6.93, 1);
      expect(Math.abs(error)).toBeLessThan(10);
    });

    it("높은 인플레이션(10%)에서 오차는 커짐 (>40bp) — 실제값 약 45bp", () => {
      const error = fisherApproxError(0.15, 0.10);
      // (1.15/1.10) - 1 = 4.545%, 근사 5%, 오차 = 45.45bp
      expect(Math.abs(error)).toBeCloseTo(45.45, 0);
      expect(Math.abs(error)).toBeGreaterThan(40);
    });

    it("근사식은 항상 실질 수익률을 과대 추정한다", () => {
      // r_approx = r_n - r_i > r_real = (1+r_n)/(1+r_i) - 1 (양의 편향)
      const nominal = 0.08;
      const inflation = 0.03;
      const approx = realReturnApprox(nominal, inflation);
      const exact = realReturn(nominal, inflation);
      expect(approx).toBeGreaterThan(exact);
    });
  });

  // ── 역산 (명목 수익률) ──────────────────────────────────────────────
  describe("nominalReturn() — 피셔 방정식 역산", () => {
    it("실질 5%, 인플레이션 3% → 명목 8.15%", () => {
      // (1.05 × 1.03) - 1 = 0.0815
      expect(nominalReturn(0.05, 0.03)).toBeCloseTo(0.0815, 4);
    });

    it("왕복 변환: nominal → real → nominal 복원", () => {
      const originalNominal = 0.09;
      const inflation = 0.025;
      const real = realReturn(originalNominal, inflation);
      const restored = nominalReturn(real, inflation);
      expect(restored).toBeCloseTo(originalNominal, 10);
    });
  });

  // ── 시계열 변환 ────────────────────────────────────────────────────
  describe("toRealReturnSeries()", () => {
    it("고정 인플레이션으로 배열 변환", () => {
      const nominal = [0.08, -0.03, 0.12];
      const real = toRealReturnSeries(nominal, 0.03);
      expect(real).toHaveLength(3);
      expect(real[0]).toBeCloseTo(realReturn(0.08, 0.03), 10);
      expect(real[1]).toBeCloseTo(realReturn(-0.03, 0.03), 10);
      expect(real[2]).toBeCloseTo(realReturn(0.12, 0.03), 10);
    });

    it("연도별 다른 인플레이션 배열 처리", () => {
      const nominal = [0.08, 0.10];
      const inflation = [0.02, 0.05];
      const real = toRealReturnSeries(nominal, inflation);
      expect(real[0]).toBeCloseTo(realReturn(0.08, 0.02), 10);
      expect(real[1]).toBeCloseTo(realReturn(0.10, 0.05), 10);
    });

    it("배열 길이 불일치 시 RangeError", () => {
      expect(() => toRealReturnSeries([0.08, 0.10], [0.02])).toThrow(RangeError);
    });
  });

  // ── 통계 분석 ──────────────────────────────────────────────────────
  describe("computeReturnStatistics()", () => {
    const returns = [0.10, -0.20, 0.15, 0.05, -0.10, 0.25, 0.08];

    it("산술 평균이 정확히 계산된다", () => {
      const stats = computeReturnStatistics(returns);
      const expected = returns.reduce((s, r) => s + r, 0) / returns.length;
      expect(stats.arithmeticMean).toBeCloseTo(expected, 10);
    });

    it("기하 평균(복리 연환산)이 산술 평균보다 낮다 (Jensen's inequality)", () => {
      const stats = computeReturnStatistics(returns);
      expect(stats.geometricMean).toBeLessThan(stats.arithmeticMean);
    });

    it("최소/최대값이 정확하다", () => {
      const stats = computeReturnStatistics(returns);
      expect(stats.min).toBeCloseTo(-0.20, 10);
      expect(stats.max).toBeCloseTo(0.25, 10);
    });

    it("음의 수익률 비율이 정확하다", () => {
      const stats = computeReturnStatistics(returns);
      // -0.20, -0.10 = 2/7
      expect(stats.negativeYearRate).toBeCloseTo(2 / 7, 5);
    });

    it("S&P 500 96년 데이터 통계 — 기하 평균 약 9~10% 범위", () => {
      const { SP500_ANNUAL_RETURNS } = require("../historicalReturns");
      const stats = computeReturnStatistics([...SP500_ANNUAL_RETURNS]);
      expect(stats.geometricMean).toBeGreaterThan(0.08);
      expect(stats.geometricMean).toBeLessThan(0.12);
    });

    it("빈 배열은 RangeError", () => {
      expect(() => computeReturnStatistics([])).toThrow(RangeError);
    });
  });

  // ── 구매력 계산 ────────────────────────────────────────────────────
  describe("purchasingPowerDecay()", () => {
    it("연 2% 인플레이션, 30년 후 구매력 = 약 55.2%", () => {
      const result = purchasingPowerDecay(100_000_000, 0.02, 30);
      // 100M / 1.02^30 ≈ 55,207,368
      expect(result).toBeCloseTo(55_207_368, -4);
    });

    it("인플레이션 0이면 구매력 유지", () => {
      expect(purchasingPowerDecay(1_000_000, 0, 10)).toBe(1_000_000);
    });
  });

  describe("inflationAdjustedAmount()", () => {
    it("3% 인플레이션, 10년 후 동일 실질 가치 유지 납입금", () => {
      // 100만원 × 1.03^10 ≈ 134만원
      const result = inflationAdjustedAmount(1_000_000, 0.03, 10);
      expect(result).toBeCloseTo(1_343_916, -2);
    });
  });

  describe("yearsToHalvePurchasingPower()", () => {
    it("연 2% 인플레이션에서 구매력 반감까지 약 35년", () => {
      const years = yearsToHalvePurchasingPower(0.02);
      // ln(2) / ln(1.02) ≈ 35.0
      expect(years).toBeCloseTo(35.003, 2);
    });

    it("연 3% 인플레이션에서 약 23.4년", () => {
      const years = yearsToHalvePurchasingPower(0.03);
      expect(years).toBeCloseTo(23.45, 1);
    });

    it("72의 법칙과 근사 일치: 72/3 = 24 ≈ 23.4", () => {
      const years = yearsToHalvePurchasingPower(0.03);
      const ruleOf72 = 72 / 3;
      expect(Math.abs(years - ruleOf72)).toBeLessThan(1);
    });

    it("음수 인플레이션은 RangeError", () => {
      expect(() => yearsToHalvePurchasingPower(-0.02)).toThrow(RangeError);
      expect(() => yearsToHalvePurchasingPower(0)).toThrow(RangeError);
    });
  });
});
