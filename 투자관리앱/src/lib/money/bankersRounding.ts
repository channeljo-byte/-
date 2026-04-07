/**
 * Banker's Rounding (Round Half to Even)
 *
 * 표준 반올림(0.5 → 항상 올림)은 대규모 금융 연산에서 통계적 상향 편향을 유발합니다.
 * 은행원 반올림은 0.5 경계값을 "가장 가까운 짝수"로 수렴시켜 편향을 제거합니다.
 *
 * 예시:
 *   0.5 → 0  (0은 짝수)
 *   1.5 → 2  (2는 짝수)
 *   2.5 → 2  (2는 짝수)
 *   3.5 → 4  (4는 짝수)
 *   4.5 → 4  (4는 짝수)
 */

/**
 * 부동소수점 비교를 위한 epsilon 값.
 * `1.5 * 10 - 15`처럼 부동소수점 오류가 0.4999...가 되는 것을 방지합니다.
 */
const FLOATING_POINT_EPSILON = 1e-10;

/**
 * 정수 단위로 은행원 반올림을 적용합니다.
 * Money 클래스의 곱셈/나눗셈 후 최소 화폐 단위로 환원할 때 사용됩니다.
 *
 * @param value - 반올림할 숫자
 * @returns 은행원 반올림이 적용된 정수
 */
export function bankersRound(value: number): number {
  const floor = Math.floor(value);
  const fraction = value - floor;

  // 정확히 0.5인 경우 (부동소수점 오차 허용)
  if (Math.abs(fraction - 0.5) < FLOATING_POINT_EPSILON) {
    // 바닥값이 짝수이면 바닥값 유지, 홀수이면 올림
    return floor % 2 === 0 ? floor : floor + 1;
  }

  // 일반적인 경우: 표준 반올림
  return Math.round(value);
}

/**
 * 지정한 소수 자릿수까지 은행원 반올림을 적용합니다.
 *
 * @param value - 반올림할 숫자
 * @param decimalPlaces - 유지할 소수 자릿수 (기본값: 0)
 * @returns 은행원 반올림이 적용된 숫자
 *
 * @example
 * bankersRoundToDecimal(1.005, 2) // 1.00 (표준: 1.01)
 * bankersRoundToDecimal(1.015, 2) // 1.02
 * bankersRoundToDecimal(2.455, 2) // 2.46 (짝수 방향)
 */
export function bankersRoundToDecimal(
  value: number,
  decimalPlaces: number = 0
): number {
  if (decimalPlaces < 0 || !Number.isInteger(decimalPlaces)) {
    throw new RangeError(
      `decimalPlaces must be a non-negative integer, got: ${decimalPlaces}`
    );
  }
  if (decimalPlaces === 0) return bankersRound(value);

  const factor = Math.pow(10, decimalPlaces);
  const shifted = value * factor;
  const rounded = bankersRound(shifted);
  return rounded / factor;
}

/**
 * 배열의 숫자들에 은행원 반올림을 적용합니다.
 * 이자 계산 배치 처리 등에 활용됩니다.
 */
export function bankersRoundAll(
  values: number[],
  decimalPlaces: number = 0
): number[] {
  return values.map((v) => bankersRoundToDecimal(v, decimalPlaces));
}
