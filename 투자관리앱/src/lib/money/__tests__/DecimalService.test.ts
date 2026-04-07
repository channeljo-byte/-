import { DecimalService } from "../DecimalService";
import { Money } from "../Money";
import { Currency } from "@/lib/types";

describe("DecimalService — 고정밀 금융 계산", () => {
  // ── 복리 계산 ─────────────────────────────────────────────────────
  describe("compoundInterest()", () => {
    it("월복리 5%, 1년 — FV = PV × (1 + 0.05/12)^12", () => {
      const principal = Money.of(1_000_000, Currency.KRW);
      const result = DecimalService.compoundInterest(principal, 0.05, 1, 12);
      // FV ≈ 1,051,162원
      expect(result.toMajorUnits()).toBeGreaterThan(1_051_000);
      expect(result.toMajorUnits()).toBeLessThan(1_052_000);
    });

    it("연복리 10%, 10년 — 복리의 마법 (2배 이상)", () => {
      const principal = Money.of(100, Currency.USD);
      const result = DecimalService.compoundInterest(principal, 0.1, 10, 1);
      // FV = $100 × 1.1^10 ≈ $259.37
      expect(result.toMajorUnits()).toBeCloseTo(259.37, 0);
    });

    it("이율 0 — 원금 그대로", () => {
      const principal = Money.of(1000, Currency.USD);
      const result = DecimalService.compoundInterest(principal, 0, 5);
      expect(result.equals(principal)).toBe(true);
    });
  });

  // ── 단리 계산 ─────────────────────────────────────────────────────
  describe("simpleInterest()", () => {
    it("연 5%, 365일 이자 = 원금 × 5%", () => {
      const principal = Money.of(1_000_000, Currency.KRW);
      const interest = DecimalService.simpleInterest(principal, 0.05, 365);
      expect(interest.toMinorUnits()).toBe(50_000);
    });

    it("연 3%, 30일 이자 계산", () => {
      const principal = Money.of(10_000_000, Currency.KRW);
      const interest = DecimalService.simpleInterest(principal, 0.03, 30);
      // 10,000,000 × 0.03 × 30/365 ≈ 24,657원
      expect(interest.toMajorUnits()).toBeGreaterThan(24_000);
      expect(interest.toMajorUnits()).toBeLessThan(25_000);
    });
  });

  // ── 대출 월 납입액 ─────────────────────────────────────────────────
  describe("loanPayment() — PMT 공식", () => {
    it("3억원, 연 3.5%, 30년 (360개월) 주택담보대출", () => {
      const principal = Money.of(300_000_000, Currency.KRW);
      const payment = DecimalService.loanPayment(principal, 0.035, 360);
      // 월 납입액 ≈ 1,347,050원 수준
      expect(payment.toMajorUnits()).toBeGreaterThan(1_300_000);
      expect(payment.toMajorUnits()).toBeLessThan(1_400_000);
    });

    it("$200,000, 연 6%, 30년 (미국 모기지)", () => {
      const principal = Money.of(200_000, Currency.USD);
      const payment = DecimalService.loanPayment(principal, 0.06, 360);
      // PMT ≈ $1,199.10
      expect(payment.toMajorUnits()).toBeGreaterThan(1_190);
      expect(payment.toMajorUnits()).toBeLessThan(1_210);
    });

    it("무이자 대출 — 원금 균등 분할", () => {
      const principal = Money.of(1_200_000, Currency.KRW);
      const payment = DecimalService.loanPayment(principal, 0, 12);
      expect(payment.toMinorUnits()).toBe(100_000);
    });
  });

  // ── 상환 스케줄 ────────────────────────────────────────────────────
  describe("amortizationSchedule()", () => {
    const principal = Money.of(12_000_000, Currency.KRW);
    const annualRate = 0.06; // 6%
    const termMonths = 12;

    let schedule: ReturnType<typeof DecimalService.amortizationSchedule>;

    beforeAll(() => {
      schedule = DecimalService.amortizationSchedule(
        principal,
        annualRate,
        termMonths
      );
    });

    it("회차 수 = 상환 개월 수", () => {
      expect(schedule).toHaveLength(termMonths);
    });

    it("1회차 기간 번호 = 1", () => {
      expect(schedule[0].period).toBe(1);
    });

    it("마지막 회차 잔여 원금 = 0", () => {
      const lastRow = schedule[schedule.length - 1];
      expect(lastRow.balance.isZero()).toBe(true);
    });

    it("이자 + 원금 = 납입액", () => {
      for (const row of schedule) {
        const sum = row.interest.toMinorUnits() + row.principal.toMinorUnits();
        expect(sum).toBe(row.payment.toMinorUnits());
      }
    });

    it("전체 원금 납입 합계 ≈ 대출 원금", () => {
      const totalPrincipal = schedule.reduce(
        (sum, row) => sum + row.principal.toMinorUnits(),
        0
      );
      // 1원 이내 오차 허용 (마지막 회차 조정)
      expect(Math.abs(totalPrincipal - principal.toMinorUnits())).toBeLessThanOrEqual(1);
    });

    it("이자는 매 회차 감소해야 함 (원리금 균등의 특성)", () => {
      for (let i = 1; i < schedule.length; i++) {
        expect(schedule[i].interest.toMinorUnits()).toBeLessThanOrEqual(
          schedule[i - 1].interest.toMinorUnits()
        );
      }
    });
  });

  // ── CAGR ──────────────────────────────────────────────────────────
  describe("cagr()", () => {
    it("2배 성장 10년 = 약 7.18% CAGR", () => {
      const initial = Money.of(1_000_000, Currency.KRW);
      const final = Money.of(2_000_000, Currency.KRW);
      const cagr = DecimalService.cagr(initial, final, 10);
      // 2^(1/10) - 1 ≈ 0.0718
      expect(cagr).toBeCloseTo(0.0718, 3);
    });

    it("원금과 같으면 CAGR = 0", () => {
      const m = Money.of(1_000_000, Currency.KRW);
      expect(DecimalService.cagr(m, m, 5)).toBeCloseTo(0, 8);
    });

    it("초기값 0이면 RangeError", () => {
      const zero = Money.zero(Currency.KRW);
      const m = Money.of(1_000_000, Currency.KRW);
      expect(() => DecimalService.cagr(zero, m, 5)).toThrow(RangeError);
    });
  });

  // ── 단순 수익률 ───────────────────────────────────────────────────
  describe("simpleReturn()", () => {
    it("수익 계산", () => {
      const cost = Money.of(1_000_000, Currency.KRW);
      const current = Money.of(1_250_000, Currency.KRW);
      const { gain, rate } = DecimalService.simpleReturn(cost, current);

      expect(gain.toMinorUnits()).toBe(250_000);
      expect(rate).toBeCloseTo(0.25, 8); // 25%
    });

    it("손실 계산", () => {
      const cost = Money.of(100, Currency.USD);
      const current = Money.of(80, Currency.USD);
      const { gain, rate } = DecimalService.simpleReturn(cost, current);

      expect(gain.isNegative()).toBe(true);
      expect(rate).toBeCloseTo(-0.2, 8); // -20%
    });
  });

  // ── 세금 계산 ──────────────────────────────────────────────────────
  describe("applyTaxRate()", () => {
    it("배당소득세 15.4% 적용", () => {
      const dividend = Money.of(1_000_000, Currency.KRW);
      const { gross, tax, net } = DecimalService.applyTaxRate(dividend, 0.154);

      expect(gross.toMinorUnits()).toBe(1_000_000);
      expect(tax.toMinorUnits()).toBe(154_000);
      expect(net.toMinorUnits()).toBe(846_000);
      // 세금 + 세후 = 세전
      expect(tax.toMinorUnits() + net.toMinorUnits()).toBe(gross.toMinorUnits());
    });

    it("양도소득세 22% 적용", () => {
      const gain = Money.of(500_000, Currency.KRW);
      const { tax, net } = DecimalService.applyTaxRate(gain, 0.22);
      expect(tax.toMinorUnits()).toBe(110_000);
      expect(net.toMinorUnits()).toBe(390_000);
    });
  });

  // ── 퍼센트 계산 ────────────────────────────────────────────────────
  describe("percentage()", () => {
    it("5.5% of $1,000 = $55", () => {
      const m = Money.of(1_000, Currency.USD);
      const result = DecimalService.percentage(m, 5.5);
      expect(result.toMinorUnits()).toBe(5500);
    });

    it("33.33% of $1 → 은행원 반올림", () => {
      const m = Money.of(1, Currency.USD);
      const result = DecimalService.percentage(m, 33.33);
      // 100센트 × 0.3333 = 33.33센트 → 33센트
      expect(result.toMinorUnits()).toBe(33);
    });
  });

  // ── 연간 수수료 ────────────────────────────────────────────────────
  describe("applyAnnualFee()", () => {
    it("0.5% 수수료 10년 — 약 4.9% 손실", () => {
      const portfolio = Money.of(10_000_000, Currency.KRW);
      const result = DecimalService.applyAnnualFee(portfolio, 0.005, 10);
      // (1 - 0.005)^10 ≈ 0.9511
      expect(result.toMajorUnits()).toBeGreaterThan(9_500_000);
      expect(result.toMajorUnits()).toBeLessThan(9_520_000);
    });
  });
});
