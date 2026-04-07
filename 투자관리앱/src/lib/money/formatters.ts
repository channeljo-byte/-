/**
 * formatters.ts — 프론트엔드 화폐 포맷팅 유틸리티
 *
 * dinero.js v2 alpha를 사용하여 Money 객체를 로케일/통화에 맞는
 * 사람이 읽기 좋은 형식으로 변환합니다.
 *
 * ⚠️  이 파일은 클라이언트 컴포넌트에서만 사용하세요.
 *     백엔드 계산은 DecimalService를 사용하세요.
 *
 * 참고: dinero.js v2에서는 모든 통화가 dinero.js 패키지에 직접 포함됩니다.
 *       (@dinero.js/currencies는 dinero.js로 통합되었습니다)
 */

import {
  dinero,
  toDecimal,
  toSnapshot,
  type Dinero,
  type DineroSnapshot,
  USD,
  EUR,
  JPY,
  KRW,
} from "dinero.js";
import { Currency } from "@/lib/types";
import { Money, CURRENCY_PRECISION } from "./Money";

// BTC는 dinero.js에 포함되지 않아 직접 정의합니다 (ISO 4217 미채택)
const BTC_CURRENCY = { code: "BTC", base: 10, exponent: 8 } as const;

// ─────────────────────────────────────────────────────────────────────
// Currency 매핑
// ─────────────────────────────────────────────────────────────────────

type DineroCurrencyDef = { code: string; base: number; exponent: number };

/** 앱의 Currency enum을 dinero.js 통화 정의 객체로 매핑 */
const DINERO_CURRENCY_MAP: Record<Currency, DineroCurrencyDef> = {
  [Currency.KRW]: KRW,
  [Currency.USD]: USD,
  [Currency.EUR]: EUR,
  [Currency.JPY]: JPY,
  [Currency.BTC]: BTC_CURRENCY,
};

/** 통화별 기본 로케일 */
const DEFAULT_LOCALE: Record<Currency, string> = {
  [Currency.KRW]: "ko-KR",
  [Currency.USD]: "en-US",
  [Currency.EUR]: "de-DE",
  [Currency.JPY]: "ja-JP",
  [Currency.BTC]: "en-US",
};

// ─────────────────────────────────────────────────────────────────────
// Money → Dinero 변환
// ─────────────────────────────────────────────────────────────────────

/**
 * Money 객체를 dinero.js의 Dinero 객체로 변환합니다.
 * dinero.js의 add, subtract, multiply 등을 사용할 때 활용하세요.
 */
export function toDinero(money: Money): Dinero<number> {
  const currency = DINERO_CURRENCY_MAP[money.currency];
  return dinero({
    amount: money.toMinorUnits(),
    currency,
  });
}

/**
 * dinero.js Dinero 객체를 Money로 변환합니다.
 */
export function fromDinero(d: Dinero<number>, currency: Currency): Money {
  const snapshot: DineroSnapshot<number> = toSnapshot(d);
  return Money.ofMinor(snapshot.amount, currency);
}

// ─────────────────────────────────────────────────────────────────────
// 포맷팅 함수
// ─────────────────────────────────────────────────────────────────────

/**
 * Money 객체를 로케일에 맞는 통화 문자열로 변환합니다.
 *
 * BTC는 ISO 4217 미채택 통화이므로 formatBTC()를 사용하세요.
 *
 * @example
 * formatMoney(Money.of(1234567, Currency.KRW))          // "₩1,234,567"
 * formatMoney(Money.of(1234.56, Currency.USD))          // "$1,234.56"
 * formatMoney(Money.of(1234.56, Currency.USD), "ko-KR") // "US$1,234.56"
 */
export function formatMoney(money: Money, locale?: string): string {
  if (money.currency === Currency.BTC) {
    return formatBTC(money);
  }

  const resolvedLocale = locale ?? DEFAULT_LOCALE[money.currency];
  const precision = CURRENCY_PRECISION[money.currency];

  // dinero.js로 정확한 소수점 변환 후 Intl로 포맷
  const decimalValue = toDecimal(toDinero(money));

  return new Intl.NumberFormat(resolvedLocale, {
    style: "currency",
    currency: money.currency,
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(Number(decimalValue));
}

/**
 * BTC 전용 포맷터.
 * Intl.NumberFormat이 BTC/XBT를 지원하지 않으므로 직접 포맷합니다.
 *
 * @example
 * formatBTC(Money.of(0.00012345, Currency.BTC)) // "₿0.00012345"
 */
export function formatBTC(money: Money): string {
  if (money.currency !== Currency.BTC) {
    throw new TypeError("formatBTC는 BTC 통화에만 사용할 수 있습니다.");
  }
  const amount = money.toMajorUnits().toFixed(8);
  return `₿${amount}`;
}

/**
 * 금액을 축약형으로 표시합니다 (대형 금액 표시용).
 *
 * @example
 * formatMoneyCompact(Money.of(1234567890, Currency.KRW)) // "12.3억원"
 * formatMoneyCompact(Money.of(1500000, Currency.USD))    // "$1.5M"
 */
export function formatMoneyCompact(money: Money, locale?: string): string {
  const resolvedLocale = locale ?? DEFAULT_LOCALE[money.currency];
  const majorAmount = money.toMajorUnits();

  if (money.currency === Currency.KRW) {
    return formatKRWCompact(majorAmount);
  }

  if (money.currency === Currency.BTC) {
    return formatBTC(money);
  }

  return new Intl.NumberFormat(resolvedLocale, {
    style: "currency",
    currency: money.currency,
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(majorAmount);
}

/**
 * 원화(KRW) 전용 축약 포맷터.
 * 한국식 단위(만, 억, 조)로 표시합니다.
 *
 * @example
 * formatKRWCompact(50000)           // "5만원"
 * formatKRWCompact(100000000)       // "1억원"
 * formatKRWCompact(1500000000000)   // "1.5조원"
 */
export function formatKRWCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (abs >= 1_0000_0000_0000) {
    const value = abs / 1_0000_0000_0000;
    return `${sign}${formatKRWNumber(value)}조원`;
  }
  if (abs >= 1_0000_0000) {
    const value = abs / 1_0000_0000;
    return `${sign}${formatKRWNumber(value)}억원`;
  }
  if (abs >= 1_0000) {
    const value = abs / 1_0000;
    return `${sign}${formatKRWNumber(value)}만원`;
  }
  return `${sign}${Math.round(abs).toLocaleString("ko-KR")}원`;
}

function formatKRWNumber(value: number): string {
  return value % 1 === 0 ? value.toString() : value.toFixed(1);
}

/**
 * 수익률을 백분율 문자열로 변환합니다.
 *
 * @example
 * formatRate(0.1234, "ko-KR")   // "+12.34%"
 * formatRate(-0.0567, "en-US")  // "-5.67%"
 */
export function formatRate(
  rate: number,
  locale: string = "ko-KR",
  decimalPlaces: number = 2
): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
    signDisplay: "always",
  }).format(rate);
}

/**
 * 두 Money 금액의 차이를 퍼센트 변화율로 포맷합니다.
 *
 * @example
 * formatChange(Money.of(100, Currency.KRW), Money.of(110, Currency.KRW))
 * // "+10.00%"
 */
export function formatChange(from: Money, to: Money): string {
  if (from.isZero()) return "—";
  const rate =
    (to.toMinorUnits() - from.toMinorUnits()) / from.toMinorUnits();
  return formatRate(rate);
}
