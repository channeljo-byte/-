/**
 * Money 클래스 - Stripe의 'No-Floating Points' 전략 + Martin Fowler의 'Money Pattern'
 *
 * 핵심 원칙:
 * 1. 모든 금액은 최소 보조 단위(subunit)의 정수로 저장 (KRW: 원, USD: 센트, BTC: 사토시)
 * 2. 사칙연산은 순수 정수 연산으로 처리
 * 3. 스칼라 곱셈/나눗셈의 반올림에는 은행원 반올림(Banker's Rounding) 적용
 * 4. 통화가 다른 Money 객체 간 연산은 명시적 예외를 발생시킴
 */

import { Currency } from "@/lib/types";
import { bankersRound } from "./bankersRounding";

/**
 * 통화별 소수점 정밀도 (최소 보조 단위 승수)
 * factor = 10^precision
 *
 * KRW: 10^0 = 1    (1원 = 1원, 보조 단위 없음)
 * USD: 10^2 = 100  (1달러 = 100센트)
 * EUR: 10^2 = 100  (1유로 = 100센트)
 * JPY: 10^0 = 1    (1엔 = 1엔, 보조 단위 없음)
 * BTC: 10^8 = 1억  (1BTC = 100,000,000 사토시)
 */
export const CURRENCY_PRECISION: Record<Currency, number> = {
  [Currency.KRW]: 0,
  [Currency.USD]: 2,
  [Currency.EUR]: 2,
  [Currency.JPY]: 0,
  [Currency.BTC]: 8,
};

export interface MoneyJSON {
  amount: number;
  currency: Currency;
}

export class Money {
  /** 최소 보조 단위의 정수 금액 (내부 표현) */
  private readonly _amount: number;
  readonly currency: Currency;

  private constructor(amount: number, currency: Currency) {
    if (!Number.isInteger(amount)) {
      throw new TypeError(
        `Money 내부 금액은 정수여야 합니다. 입력값: ${amount}. ` +
          `Money.of()로 주요 단위를 입력하거나 Money.ofMinor()로 보조 단위를 입력하세요.`
      );
    }
    if (!Number.isSafeInteger(amount)) {
      throw new RangeError(
        `금액이 안전한 정수 범위를 초과했습니다: ${amount}`
      );
    }
    this._amount = amount;
    this.currency = currency;
  }

  // ─────────────────────────────────────────────────────────────────────
  // 팩토리 메서드
  // ─────────────────────────────────────────────────────────────────────

  /**
   * 주요 단위(major unit)로 Money를 생성합니다.
   * 내부적으로 최소 보조 단위 정수로 변환합니다.
   *
   * @example
   * Money.of(100.50, Currency.USD)  // $100.50 → 10050 cents
   * Money.of(50000, Currency.KRW)   // 5만원 → 50000원
   * Money.of(0.001, Currency.BTC)   // 0.001 BTC → 100000 satoshis
   */
  static of(majorAmount: number, currency: Currency): Money {
    const factor = Money.factorOf(currency);
    const minor = bankersRound(majorAmount * factor);
    return new Money(minor, currency);
  }

  /**
   * 최소 보조 단위(minor unit) 정수로 Money를 생성합니다.
   * DB 저장값 또는 API 응답값 복원 시 사용합니다.
   *
   * @example
   * Money.ofMinor(10050, Currency.USD)  // 10050 cents = $100.50
   * Money.ofMinor(50000, Currency.KRW)  // 50000원
   */
  static ofMinor(minorAmount: number, currency: Currency): Money {
    return new Money(minorAmount, currency);
  }

  /** 해당 통화의 0원짜리 Money를 생성합니다. */
  static zero(currency: Currency): Money {
    return new Money(0, currency);
  }

  // ─────────────────────────────────────────────────────────────────────
  // 내부 유틸리티
  // ─────────────────────────────────────────────────────────────────────

  /** 통화의 정밀도 승수(factor = 10^precision)를 반환합니다. */
  static factorOf(currency: Currency): number {
    return Math.pow(10, CURRENCY_PRECISION[currency]);
  }

  private get factor(): number {
    return Money.factorOf(this.currency);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new TypeError(
        `통화 불일치: ${this.currency}와 ${other.currency}는 직접 연산할 수 없습니다. ` +
          `환율을 적용하여 동일 통화로 변환 후 연산하세요.`
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // 접근자
  // ─────────────────────────────────────────────────────────────────────

  /** 최소 보조 단위 정수 금액을 반환합니다 (DB 저장용). */
  toMinorUnits(): number {
    return this._amount;
  }

  /** 주요 단위 소수 금액을 반환합니다 (표시용). */
  toMajorUnits(): number {
    return this._amount / this.factor;
  }

  // ─────────────────────────────────────────────────────────────────────
  // 사칙연산 — 정수 기반 (부동소수점 오류 없음)
  // ─────────────────────────────────────────────────────────────────────

  /**
   * 덧셈. 보조 단위 정수끼리 더합니다.
   * @throws {TypeError} 통화가 다를 경우
   */
  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount + other._amount, this.currency);
  }

  /**
   * 뺄셈. 보조 단위 정수끼리 뺍니다.
   * @throws {TypeError} 통화가 다를 경우
   */
  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount - other._amount, this.currency);
  }

  /**
   * 스칼라 곱셈. 이자율, 수량 등 소수 배수를 곱합니다.
   * 결과의 반올림에 은행원 반올림을 적용합니다.
   *
   * @example
   * Money.of(100, Currency.USD).multiply(1.05)  // $100 × 1.05 = $105.00
   * Money.of(100, Currency.USD).multiply(0.333) // $100 × 0.333 = $33.30 (banker's round)
   */
  multiply(factor: number): Money {
    const result = bankersRound(this._amount * factor);
    return new Money(result, this.currency);
  }

  /**
   * 스칼라 나눗셈. 결과의 반올림에 은행원 반올림을 적용합니다.
   * @throws {RangeError} 0으로 나눌 경우
   */
  divide(divisor: number): Money {
    if (divisor === 0) {
      throw new RangeError("0으로 나눌 수 없습니다.");
    }
    const result = bankersRound(this._amount / divisor);
    return new Money(result, this.currency);
  }

  /**
   * 비율 배분(allocate) — Largest Remainder Method
   *
   * 금액을 지정한 비율로 나눌 때 반올림 오차로 인한 잔돈(penny)이 소실되지 않도록
   * 보장합니다. 총합은 항상 원래 금액과 정확히 일치합니다.
   *
   * @example
   * // $100를 1:1:1 비율로 나누기
   * money.allocate([1, 1, 1])
   * // → [$33.34, $33.33, $33.33] (합계 = $100.00)
   */
  allocate(ratios: number[]): Money[] {
    if (ratios.length === 0) {
      throw new RangeError("비율 배열이 비어있습니다.");
    }
    if (ratios.some((r) => r < 0)) {
      throw new RangeError("비율은 음수가 될 수 없습니다.");
    }

    const total = ratios.reduce((sum, r) => sum + r, 0);
    if (total === 0) {
      throw new RangeError("비율의 합이 0이 될 수 없습니다.");
    }

    // 1단계: floor 기반 배분
    const shares = ratios.map((r) =>
      Math.floor((r / total) * this._amount)
    );

    // 2단계: 반올림으로 인한 잔여분 계산
    const allocated = shares.reduce((sum, s) => sum + s, 0);
    let remainder = this._amount - allocated;

    // 3단계: Largest Remainder Method — 소수점 이하 큰 순서대로 1씩 추가
    const fractions = ratios.map((r, i) => ({
      index: i,
      fraction: (r / total) * this._amount - Math.floor((r / total) * this._amount),
    }));
    fractions.sort((a, b) => b.fraction - a.fraction);

    for (let i = 0; remainder > 0; i++, remainder--) {
      shares[fractions[i % fractions.length].index] += 1;
    }

    return shares.map((s) => new Money(s, this.currency));
  }

  /** 부호를 반전시킵니다. */
  negate(): Money {
    return new Money(-this._amount, this.currency);
  }

  /** 절댓값을 반환합니다. */
  abs(): Money {
    return new Money(Math.abs(this._amount), this.currency);
  }

  // ─────────────────────────────────────────────────────────────────────
  // 비교 연산
  // ─────────────────────────────────────────────────────────────────────

  equals(other: Money): boolean {
    return this.currency === other.currency && this._amount === other._amount;
  }

  greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount > other._amount;
  }

  lessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount < other._amount;
  }

  greaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount >= other._amount;
  }

  lessThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount <= other._amount;
  }

  isZero(): boolean {
    return this._amount === 0;
  }

  isPositive(): boolean {
    return this._amount > 0;
  }

  isNegative(): boolean {
    return this._amount < 0;
  }

  // ─────────────────────────────────────────────────────────────────────
  // 직렬화
  // ─────────────────────────────────────────────────────────────────────

  /**
   * 사람이 읽기 쉬운 문자열 표현.
   * DB 저장이나 API 응답에는 toJSON()을 사용하세요.
   */
  toString(): string {
    const major = (this._amount / this.factor).toFixed(
      CURRENCY_PRECISION[this.currency]
    );
    return `${major} ${this.currency}`;
  }

  /** JSON 직렬화 — 보조 단위 정수로 저장합니다. */
  toJSON(): MoneyJSON {
    return {
      amount: this._amount,
      currency: this.currency,
    };
  }

  /** JSON 역직렬화 */
  static fromJSON(json: MoneyJSON): Money {
    return Money.ofMinor(json.amount, json.currency);
  }
}
