/**
 * DecimalService — 백엔드 전용 고정밀 금융 계산 엔진
 *
 * decimal.js를 래핑하여 이자 계산, 대출 상환, 세금 등
 * 부동소수점으로 처리 불가능한 복잡한 금융 연산을 처리합니다.
 *
 * ⚠️  이 서비스는 서버(Node.js) 환경에서만 사용하세요.
 *     클라이언트 포맷팅은 formatters.ts를 사용하세요.
 */

import Decimal from "decimal.js";
import { Currency } from "@/lib/types";
import { Money } from "./Money";

// decimal.js 전역 설정 — 금융 계산에 최적화
Decimal.set({
  precision: 28,            // 28자리 정밀도 (Stripe 기준)
  rounding: Decimal.ROUND_HALF_EVEN, // 은행원 반올림
  toExpPos: 28,
  toExpNeg: -7,
});

export interface AmortizationRow {
  /** 회차 (1부터 시작) */
  period: number;
  /** 월 납입액 */
  payment: Money;
  /** 이자 납입액 */
  interest: Money;
  /** 원금 납입액 */
  principal: Money;
  /** 잔여 원금 */
  balance: Money;
}

export interface TaxResult {
  /** 세전 금액 */
  gross: Money;
  /** 세액 */
  tax: Money;
  /** 세후 금액 */
  net: Money;
}

export interface ReturnResult {
  /** 수익 금액 */
  gain: Money;
  /** 수익률 (소수, 예: 0.125 = 12.5%) */
  rate: number;
}

/**
 * 고정밀 금융 계산 서비스
 * 내부적으로 decimal.js를 사용하며, 입출력은 Money 객체로 처리합니다.
 */
export class DecimalService {
  // ─────────────────────────────────────────────────────────────────────
  // 이자 계산
  // ─────────────────────────────────────────────────────────────────────

  /**
   * 복리(Compound Interest) 계산
   *
   * FV = PV × (1 + r/n)^(n×t)
   *
   * @param principal - 원금
   * @param annualRate - 연이율 (소수, 예: 0.05 = 5%)
   * @param years - 기간 (년)
   * @param compoundsPerYear - 연간 복리 횟수 (기본: 12 = 월복리)
   * @returns 만기 시 원리금 합계
   */
  static compoundInterest(
    principal: Money,
    annualRate: number,
    years: number,
    compoundsPerYear: number = 12
  ): Money {
    const pv = new Decimal(principal.toMinorUnits());
    const r = new Decimal(annualRate).div(compoundsPerYear);
    const n = new Decimal(compoundsPerYear).mul(years);
    const fv = pv.mul(Decimal.pow(r.plus(1), n));
    return Money.ofMinor(
      fv.toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).toNumber(),
      principal.currency
    );
  }

  /**
   * 단리(Simple Interest) 계산
   *
   * I = PV × r × t
   *
   * @param principal - 원금
   * @param annualRate - 연이율 (소수)
   * @param days - 기간 (일)
   * @returns 이자 금액
   */
  static simpleInterest(
    principal: Money,
    annualRate: number,
    days: number
  ): Money {
    const pv = new Decimal(principal.toMinorUnits());
    const dailyRate = new Decimal(annualRate).div(365);
    const interest = pv.mul(dailyRate).mul(days);
    return Money.ofMinor(
      interest.toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).toNumber(),
      principal.currency
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // 대출 계산
  // ─────────────────────────────────────────────────────────────────────

  /**
   * 원리금 균등 상환 월 납입액(PMT) 계산
   *
   * PMT = P × [r(1+r)^n] / [(1+r)^n - 1]
   *
   * @param principal - 대출 원금
   * @param annualRate - 연이율 (소수, 예: 0.035 = 3.5%)
   * @param termMonths - 대출 기간 (월)
   * @returns 월 납입액
   */
  static loanPayment(
    principal: Money,
    annualRate: number,
    termMonths: number
  ): Money {
    if (annualRate === 0) {
      // 무이자 대출
      return Money.ofMinor(
        Math.ceil(principal.toMinorUnits() / termMonths),
        principal.currency
      );
    }

    const p = new Decimal(principal.toMinorUnits());
    const r = new Decimal(annualRate).div(12); // 월이율
    const n = new Decimal(termMonths);
    const onePlusR = r.plus(1);
    const onePlusRPowN = Decimal.pow(onePlusR, n);

    // PMT = P × r × (1+r)^n / ((1+r)^n - 1)
    const numerator = p.mul(r).mul(onePlusRPowN);
    const denominator = onePlusRPowN.minus(1);
    const pmt = numerator.div(denominator);

    return Money.ofMinor(
      pmt.toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).toNumber(),
      principal.currency
    );
  }

  /**
   * 대출 상환 스케줄(Amortization Schedule) 생성
   *
   * @param principal - 대출 원금
   * @param annualRate - 연이율 (소수)
   * @param termMonths - 대출 기간 (월)
   * @returns 월별 상환 내역 배열
   */
  static amortizationSchedule(
    principal: Money,
    annualRate: number,
    termMonths: number
  ): AmortizationRow[] {
    const monthlyPayment = DecimalService.loanPayment(
      principal,
      annualRate,
      termMonths
    );

    const monthlyRate = new Decimal(annualRate).div(12);
    const schedule: AmortizationRow[] = [];
    let balance = new Decimal(principal.toMinorUnits());
    const currency = principal.currency;

    for (let period = 1; period <= termMonths; period++) {
      // 이자 = 잔여 원금 × 월이율
      const interestAmount = balance
        .mul(monthlyRate)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN);

      // 원금 납입 = 월 납입액 - 이자
      let principalAmount = new Decimal(monthlyPayment.toMinorUnits()).minus(
        interestAmount
      );

      // 마지막 회차: 잔여 원금을 모두 상환 (누적 오차 처리)
      if (period === termMonths) {
        principalAmount = balance;
      }

      balance = balance.minus(principalAmount);

      schedule.push({
        period,
        payment: Money.ofMinor(
          period === termMonths
            ? interestAmount.plus(principalAmount).toNumber()
            : monthlyPayment.toMinorUnits(),
          currency
        ),
        interest: Money.ofMinor(interestAmount.toNumber(), currency),
        principal: Money.ofMinor(principalAmount.toNumber(), currency),
        balance: Money.ofMinor(
          balance.toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).toNumber(),
          currency
        ),
      });
    }

    return schedule;
  }

  // ─────────────────────────────────────────────────────────────────────
  // 수익률 계산
  // ─────────────────────────────────────────────────────────────────────

  /**
   * CAGR (Compound Annual Growth Rate, 연평균 성장률) 계산
   *
   * CAGR = (FV/PV)^(1/t) - 1
   *
   * @param initialValue - 초기 투자금
   * @param finalValue - 최종 평가금
   * @param years - 투자 기간 (년)
   * @returns CAGR (소수, 예: 0.125 = 12.5%)
   */
  static cagr(
    initialValue: Money,
    finalValue: Money,
    years: number
  ): number {
    if (initialValue.isZero()) {
      throw new RangeError("초기 투자금이 0이면 CAGR을 계산할 수 없습니다.");
    }
    const pv = new Decimal(initialValue.toMinorUnits());
    const fv = new Decimal(finalValue.toMinorUnits());
    const t = new Decimal(years);
    const ratio = fv.div(pv);
    const cagr = Decimal.pow(ratio, new Decimal(1).div(t)).minus(1);
    return cagr.toDecimalPlaces(10).toNumber();
  }

  /**
   * 단순 수익률(Simple Return) 계산
   *
   * @param costBasis - 매입 원가 (총 투자금)
   * @param currentValue - 현재 평가금
   * @returns 수익 금액 및 수익률
   */
  static simpleReturn(costBasis: Money, currentValue: Money): ReturnResult {
    const gain = currentValue.subtract(costBasis);
    const rate = new Decimal(gain.toMinorUnits())
      .div(new Decimal(costBasis.toMinorUnits()))
      .toDecimalPlaces(10)
      .toNumber();
    return { gain, rate };
  }

  // ─────────────────────────────────────────────────────────────────────
  // 세금 계산
  // ─────────────────────────────────────────────────────────────────────

  /**
   * 세금 계산 (세전 금액 기준)
   *
   * @param grossAmount - 세전 금액
   * @param taxRate - 세율 (소수, 예: 0.154 = 15.4% 배당소득세)
   * @returns { gross, tax, net }
   */
  static applyTaxRate(grossAmount: Money, taxRate: number): TaxResult {
    const gross = new Decimal(grossAmount.toMinorUnits());
    const tax = gross
      .mul(new Decimal(taxRate))
      .toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN);
    const net = gross.minus(tax);
    const currency = grossAmount.currency;

    return {
      gross: grossAmount,
      tax: Money.ofMinor(tax.toNumber(), currency),
      net: Money.ofMinor(net.toNumber(), currency),
    };
  }

  /**
   * 퍼센트 금액 계산
   *
   * @param amount - 기준 금액
   * @param percent - 퍼센트 (예: 5.5 = 5.5%)
   * @returns 퍼센트에 해당하는 금액
   */
  static percentage(amount: Money, percent: number): Money {
    const base = new Decimal(amount.toMinorUnits());
    const result = base
      .mul(new Decimal(percent).div(100))
      .toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN);
    return Money.ofMinor(result.toNumber(), amount.currency);
  }

  /**
   * 연간 수수료(MER/TER) 적용 후 실질 금액 계산
   *
   * @param portfolioValue - 포트폴리오 평가금
   * @param annualFeeRate - 연간 수수료율 (소수, 예: 0.005 = 0.5%)
   * @param years - 보유 기간 (년)
   * @returns 수수료 차감 후 금액
   */
  static applyAnnualFee(
    portfolioValue: Money,
    annualFeeRate: number,
    years: number
  ): Money {
    const pv = new Decimal(portfolioValue.toMinorUnits());
    // 수수료를 반영한 성장 계수: (1 - fee_rate)^years
    const feeMultiplier = Decimal.pow(
      new Decimal(1).minus(new Decimal(annualFeeRate)),
      new Decimal(years)
    );
    const result = pv.mul(feeMultiplier).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN);
    return Money.ofMinor(result.toNumber(), portfolioValue.currency);
  }
}
