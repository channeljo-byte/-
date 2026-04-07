import { Money, CURRENCY_PRECISION } from "../Money";
import { Currency } from "@/lib/types";

describe("Money 클래스 — 정수 기반 화폐 연산", () => {
  // ── 팩토리 메서드 ─────────────────────────────────────────────────
  describe("Money.of() — 주요 단위 생성", () => {
    it("USD: 주요 단위(달러) → 보조 단위(센트) 정수 변환", () => {
      const m = Money.of(100.5, Currency.USD);
      expect(m.toMinorUnits()).toBe(10050);
      expect(m.currency).toBe(Currency.USD);
    });

    it("KRW: 보조 단위 없음, 1원 = 1원", () => {
      const m = Money.of(50000, Currency.KRW);
      expect(m.toMinorUnits()).toBe(50000);
    });

    it("BTC: 1 BTC = 100,000,000 사토시", () => {
      const m = Money.of(0.001, Currency.BTC);
      expect(m.toMinorUnits()).toBe(100_000);
    });

    it("소수점 변환 시 은행원 반올림 적용", () => {
      // 1/3 달러 → 33.33...센트 → 33센트
      const m = Money.of(1 / 3, Currency.USD);
      expect(m.toMinorUnits()).toBe(33);
    });
  });

  describe("Money.ofMinor() — 보조 단위로 직접 생성", () => {
    it("센트 직접 입력", () => {
      const m = Money.ofMinor(10050, Currency.USD);
      expect(m.toMajorUnits()).toBeCloseTo(100.5, 10);
    });

    it("비정수 입력 시 TypeError", () => {
      expect(() => Money.ofMinor(10.5, Currency.USD)).toThrow(TypeError);
    });
  });

  describe("Money.zero()", () => {
    it("해당 통화의 0 반환", () => {
      const m = Money.zero(Currency.KRW);
      expect(m.isZero()).toBe(true);
      expect(m.currency).toBe(Currency.KRW);
    });
  });

  // ── 덧셈 / 뺄셈 ──────────────────────────────────────────────────
  describe("add() — 부동소수점 오류 없는 정수 덧셈", () => {
    it("기본 덧셈", () => {
      const a = Money.of(100.1, Currency.USD);
      const b = Money.of(200.2, Currency.USD);
      // 10010 + 20020 = 30030 센트 = $300.30
      expect(a.add(b).toMinorUnits()).toBe(30030);
    });

    it("부동소수점 오류 시나리오 방지: 0.1 + 0.2 !== 0.3 (float)", () => {
      // JS 기본: 0.1 + 0.2 = 0.30000000000000004 (오류)
      // Money: 10 + 20 = 30 센트 = $0.30 (정확)
      const a = Money.of(0.1, Currency.USD);
      const b = Money.of(0.2, Currency.USD);
      const result = a.add(b);
      expect(result.toMinorUnits()).toBe(30);
      expect(result.toMajorUnits()).toBeCloseTo(0.3, 10);
    });

    it("통화 불일치 시 TypeError", () => {
      const usd = Money.of(100, Currency.USD);
      const krw = Money.of(100, Currency.KRW);
      expect(() => usd.add(krw)).toThrow(TypeError);
    });
  });

  describe("subtract()", () => {
    it("기본 뺄셈", () => {
      const a = Money.of(500, Currency.KRW);
      const b = Money.of(200, Currency.KRW);
      expect(a.subtract(b).toMinorUnits()).toBe(300);
    });

    it("음수 결과 허용 (미수 표현)", () => {
      const a = Money.of(100, Currency.USD);
      const b = Money.of(150, Currency.USD);
      expect(a.subtract(b).isNegative()).toBe(true);
      expect(a.subtract(b).toMinorUnits()).toBe(-5000);
    });
  });

  // ── 스칼라 곱셈 / 나눗셈 ─────────────────────────────────────────
  describe("multiply() — 은행원 반올림 적용", () => {
    it("정수 배수", () => {
      const m = Money.of(100, Currency.USD);
      expect(m.multiply(3).toMinorUnits()).toBe(30000);
    });

    it("이율 적용 (3.5% = 0.035)", () => {
      // $1,000 × 0.035 = $35.00 → 3500센트
      const principal = Money.of(1000, Currency.USD);
      expect(principal.multiply(0.035).toMinorUnits()).toBe(3500);
    });

    it("0.5 경계 — 은행원 반올림: 짝수 방향", () => {
      // 1센트 × 0.5 = 0.5 → 0 (0은 짝수)
      const oneCent = Money.ofMinor(1, Currency.USD);
      expect(oneCent.multiply(0.5).toMinorUnits()).toBe(0);

      // 3센트 × 0.5 = 1.5 → 2 (2는 짝수)
      const threeCent = Money.ofMinor(3, Currency.USD);
      expect(threeCent.multiply(0.5).toMinorUnits()).toBe(2);
    });
  });

  describe("divide() — 은행원 반올림 적용", () => {
    it("균등 분할", () => {
      // $100 ÷ 4 = $25
      const m = Money.of(100, Currency.USD);
      expect(m.divide(4).toMinorUnits()).toBe(2500);
    });

    it("나머지 발생 시 은행원 반올림", () => {
      // $1 ÷ 3 = 33.33...센트 → 33센트
      const m = Money.of(1, Currency.USD);
      expect(m.divide(3).toMinorUnits()).toBe(33);
    });

    it("0 나눗셈 시 RangeError", () => {
      const m = Money.of(100, Currency.USD);
      expect(() => m.divide(0)).toThrow(RangeError);
    });
  });

  // ── 비율 배분 ─────────────────────────────────────────────────────
  describe("allocate() — Largest Remainder Method", () => {
    it("균등 3분할 — 잔돈 보존", () => {
      // $100 ÷ 3 = $33.33..., 나머지 1센트는 첫 번째에 추가
      const m = Money.of(100, Currency.USD);
      const [a, b, c] = m.allocate([1, 1, 1]);
      const total = a.toMinorUnits() + b.toMinorUnits() + c.toMinorUnits();
      expect(total).toBe(m.toMinorUnits()); // 잔돈 소실 없음
      // 가장 큰 나머지가 첫 번째에 추가됨
      expect(a.toMinorUnits()).toBe(3334);
      expect(b.toMinorUnits()).toBe(3333);
      expect(c.toMinorUnits()).toBe(3333);
    });

    it("비율 배분 — 합계 보존 검증", () => {
      const m = Money.of(1000, Currency.KRW);
      const allocated = m.allocate([70, 20, 10]);
      const total = allocated.reduce(
        (sum, part) => sum + part.toMinorUnits(),
        0
      );
      expect(total).toBe(m.toMinorUnits());
    });

    it("1:1 분할", () => {
      const m = Money.ofMinor(101, Currency.USD); // 홀수 센트
      const [a, b] = m.allocate([1, 1]);
      expect(a.toMinorUnits() + b.toMinorUnits()).toBe(101);
    });

    it("빈 비율 배열 시 RangeError", () => {
      expect(() => Money.of(100, Currency.USD).allocate([])).toThrow(
        RangeError
      );
    });

    it("음수 비율 시 RangeError", () => {
      expect(() => Money.of(100, Currency.USD).allocate([1, -1])).toThrow(
        RangeError
      );
    });
  });

  // ── 비교 연산 ─────────────────────────────────────────────────────
  describe("비교 연산", () => {
    const m100 = Money.of(100, Currency.USD);
    const m200 = Money.of(200, Currency.USD);
    const m100b = Money.of(100, Currency.USD);

    it("equals()", () => {
      expect(m100.equals(m100b)).toBe(true);
      expect(m100.equals(m200)).toBe(false);
    });

    it("greaterThan()", () => {
      expect(m200.greaterThan(m100)).toBe(true);
      expect(m100.greaterThan(m200)).toBe(false);
    });

    it("lessThan()", () => {
      expect(m100.lessThan(m200)).toBe(true);
    });

    it("isZero() / isPositive() / isNegative()", () => {
      expect(Money.zero(Currency.KRW).isZero()).toBe(true);
      expect(m100.isPositive()).toBe(true);
      expect(m100.negate().isNegative()).toBe(true);
    });
  });

  // ── 직렬화 ────────────────────────────────────────────────────────
  describe("직렬화 / 역직렬화", () => {
    it("toJSON / fromJSON 왕복", () => {
      const original = Money.of(1234.56, Currency.USD);
      const json = original.toJSON();
      const restored = Money.fromJSON(json);
      expect(restored.equals(original)).toBe(true);
    });

    it("JSON 구조: 보조 단위 정수로 저장", () => {
      const m = Money.of(99.99, Currency.USD);
      expect(m.toJSON()).toEqual({ amount: 9999, currency: Currency.USD });
    });

    it("toString 포맷", () => {
      const usd = Money.of(123.45, Currency.USD);
      expect(usd.toString()).toBe("123.45 USD");
      const krw = Money.of(50000, Currency.KRW);
      expect(krw.toString()).toBe("50000 KRW");
    });
  });

  // ── 정밀도 상수 ───────────────────────────────────────────────────
  describe("CURRENCY_PRECISION", () => {
    it("각 통화의 정밀도 확인", () => {
      expect(CURRENCY_PRECISION[Currency.KRW]).toBe(0);
      expect(CURRENCY_PRECISION[Currency.USD]).toBe(2);
      expect(CURRENCY_PRECISION[Currency.EUR]).toBe(2);
      expect(CURRENCY_PRECISION[Currency.JPY]).toBe(0);
      expect(CURRENCY_PRECISION[Currency.BTC]).toBe(8);
    });
  });
});
