import { bankersRound, bankersRoundToDecimal, bankersRoundAll } from "../bankersRounding";

describe("bankersRound (정수 반올림)", () => {
  // ── 기본 동작 ──────────────────────────────────────────────────────
  describe("표준 반올림 구간", () => {
    it("0.4 이하는 내림", () => {
      expect(bankersRound(1.4)).toBe(1);
      expect(bankersRound(2.4)).toBe(2);
      expect(bankersRound(0.1)).toBe(0);
    });

    it("0.6 이상은 올림", () => {
      expect(bankersRound(1.6)).toBe(2);
      expect(bankersRound(2.6)).toBe(3);
      expect(bankersRound(0.9)).toBe(1);
    });

    it("정수는 그대로 반환", () => {
      expect(bankersRound(0)).toBe(0);
      expect(bankersRound(5)).toBe(5);
      expect(bankersRound(-3)).toBe(-3);
    });
  });

  // ── 핵심: 0.5 경계값 처리 ─────────────────────────────────────────
  describe("0.5 경계값 — 가장 가까운 짝수로 수렴 (Banker's Rounding)", () => {
    it("0.5 → 0 (0은 짝수)", () => {
      expect(bankersRound(0.5)).toBe(0);
    });

    it("1.5 → 2 (2는 짝수)", () => {
      expect(bankersRound(1.5)).toBe(2);
    });

    it("2.5 → 2 (2는 짝수)", () => {
      expect(bankersRound(2.5)).toBe(2);
    });

    it("3.5 → 4 (4는 짝수)", () => {
      expect(bankersRound(3.5)).toBe(4);
    });

    it("4.5 → 4 (4는 짝수)", () => {
      expect(bankersRound(4.5)).toBe(4);
    });

    it("5.5 → 6 (6는 짝수)", () => {
      expect(bankersRound(5.5)).toBe(6);
    });

    it("10.5 → 10 (10은 짝수)", () => {
      expect(bankersRound(10.5)).toBe(10);
    });

    it("11.5 → 12 (12는 짝수)", () => {
      expect(bankersRound(11.5)).toBe(12);
    });
  });

  // ── 통계적 편향 검증 ──────────────────────────────────────────────
  describe("통계적 상향 편향 제거 검증", () => {
    it("연속 0.5 값들의 합이 0에 가까워야 함 (표준 반올림은 양의 편향 발생)", () => {
      // 0.5, 1.5, 2.5, ... 9.5 — 총 10개 값
      const halfValues = Array.from({ length: 10 }, (_, i) => i + 0.5);

      const bankersSum = halfValues.reduce(
        (sum, v) => sum + bankersRound(v),
        0
      );
      const standardSum = halfValues.reduce(
        (sum, v) => sum + Math.round(v),
        0
      );

      // 은행원 반올림: 0+2+2+4+4+6+6+8+8+10 = 50
      // 표준 반올림:   1+2+3+4+5+6+7+8+9+10 = 55 (편향 +5)
      expect(bankersSum).toBeLessThan(standardSum);

      // 진짜 평균(0.5~9.5 → 평균 5.0)과 더 가까워야 함
      const trueSum = halfValues.reduce((sum, v) => sum + v, 0); // 50.0
      expect(Math.abs(bankersSum - trueSum)).toBeLessThanOrEqual(
        Math.abs(standardSum - trueSum)
      );
    });
  });

  // ── 음수 처리 ──────────────────────────────────────────────────────
  describe("음수 처리", () => {
    it("-1.4는 -1 (내림 → -1 방향)", () => {
      expect(bankersRound(-1.4)).toBe(-1);
    });

    it("-1.6은 -2", () => {
      expect(bankersRound(-1.6)).toBe(-2);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────

describe("bankersRoundToDecimal (소수점 반올림)", () => {
  it("소수점 2자리 — 0.005 경계값", () => {
    // 1.005 → 1.00 (짝수 방향 = 0이 짝수)
    expect(bankersRoundToDecimal(1.005, 2)).toBe(1.0);
    // 1.015 → 1.02 (짝수 방향 = 2가 짝수)
    expect(bankersRoundToDecimal(1.015, 2)).toBe(1.02);
    // 1.025 → 1.02 (짝수 방향 = 2가 짝수)
    expect(bankersRoundToDecimal(1.025, 2)).toBe(1.02);
  });

  it("소수점 1자리", () => {
    expect(bankersRoundToDecimal(0.25, 1)).toBe(0.2);
    expect(bankersRoundToDecimal(0.35, 1)).toBe(0.4);
    expect(bankersRoundToDecimal(0.45, 1)).toBe(0.4);
    expect(bankersRoundToDecimal(0.55, 1)).toBe(0.6);
  });

  it("소수점 0자리 — bankersRound와 동일", () => {
    expect(bankersRoundToDecimal(2.5, 0)).toBe(2);
    expect(bankersRoundToDecimal(3.5, 0)).toBe(4);
  });

  it("음수 decimalPlaces는 오류 발생", () => {
    expect(() => bankersRoundToDecimal(1.5, -1)).toThrow(RangeError);
  });

  it("비정수 decimalPlaces는 오류 발생", () => {
    expect(() => bankersRoundToDecimal(1.5, 1.5)).toThrow(RangeError);
  });
});

// ──────────────────────────────────────────────────────────────────────

describe("bankersRoundAll (배열 처리)", () => {
  it("배열 전체에 은행원 반올림 적용", () => {
    const values = [0.5, 1.5, 2.5, 3.5];
    expect(bankersRoundAll(values)).toEqual([0, 2, 2, 4]);
  });

  it("소수점 1자리로 배열 반올림", () => {
    const values = [0.25, 0.35, 0.45, 0.55];
    expect(bankersRoundAll(values, 1)).toEqual([0.2, 0.4, 0.4, 0.6]);
  });
});
