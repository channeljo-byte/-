/**
 * historicalReturns.ts — 과거 시장 수익률 데이터 및 Bootstrap 샘플링
 *
 * ─── 데이터 출처 ─────────────────────────────────────────────────────
 * S&P 500: Robert Shiller (http://www.econ.yale.edu/~shiller/data.htm)
 *          Damodaran (https://pages.stern.nyu.edu/~adamodar/)
 * KOSPI:   한국거래소(KRX), 금융투자협회(KOFIA)
 *
 * ⚠️  교육/시뮬레이션 목적 데이터입니다.
 *     실제 자산 운용에는 인가된 데이터 제공업체의 데이터를 사용하세요.
 * ─────────────────────────────────────────────────────────────────────
 *
 * ─── Bootstrap 방법론 ────────────────────────────────────────────────
 * 복원 추출(Sampling with Replacement): 과거 수익률 풀에서 각 연도의
 * 수익률을 독립적으로 랜덤 추출합니다.
 * - 장점: 실제 분포를 보존, 정규성 가정 불필요
 * - 단점: 수익률 간 시계열 상관관계 무시 (Sequence of Returns Risk 과소평가 가능)
 * ─────────────────────────────────────────────────────────────────────
 */

// ─────────────────────────────────────────────────────────────────────
// 결정론적 PRNG (재현 가능한 테스트용)
// ─────────────────────────────────────────────────────────────────────

/**
 * Mulberry32 — 빠르고 균일한 분포를 가진 시드 기반 PRNG.
 * 시드가 고정되면 항상 동일한 난수 시퀀스를 생성합니다.
 *
 * @param seed - 32비트 정수 시드 (기본: Math.random() × 2^32)
 * @returns    - [0, 1) 범위의 랜덤 숫자를 반환하는 함수
 */
export function createSeededRng(seed?: number): () => number {
  let s = seed ?? Math.floor(Math.random() * 0xffffffff);
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────────────────────────────────────────────────
// S&P 500 연간 총수익률 데이터 (1928–2023)
// ─────────────────────────────────────────────────────────────────────

/**
 * S&P 500 연간 총수익률 (배당 포함, 소수 표현)
 * 출처: Robert Shiller, Damodaran Data
 * 기간: 1928~2023 (96개년)
 */
export const SP500_ANNUAL_RETURNS: readonly number[] = [
  // 1928-1939: 대공황 전후
  0.4381, -0.0830, -0.2490, -0.4334, -0.0819, 0.5399,
  -0.0144, 0.4767, 0.3381, -0.3503, 0.3112, -0.0041,
  // 1940-1949
  -0.0978, -0.1159, 0.2034, 0.2593, 0.1975, 0.3644,
  -0.0810, 0.0571, 0.0550, 0.1879,
  // 1950-1959
  0.3170, 0.2402, 0.1837, -0.0099, 0.5262, 0.3156,
  0.0656, -0.1078, 0.4336, 0.1195,
  // 1960-1969
  0.0048, 0.2689, -0.0873, 0.2280, 0.1648, 0.1245,
  -0.1006, 0.2398, 0.1106, -0.0847,
  // 1970-1979: 스태그플레이션 시대
  0.0401, 0.1431, 0.1898, -0.1469, -0.2647, 0.3720,
  0.2384, -0.0718, 0.0656, 0.1859,
  // 1980-1989: 레이거노믹스 호황
  0.3242, -0.0491, 0.2141, 0.2251, 0.0627, 0.3216,
  0.1847, 0.0520, 0.1681, 0.3149,
  // 1990-1999: 인터넷 버블 상승
  -0.0317, 0.3055, 0.0762, 0.1008, 0.0132, 0.3758,
  0.2296, 0.3336, 0.2858, 0.2104,
  // 2000-2009: 잃어버린 10년
  -0.0910, -0.1189, -0.2210, 0.2868, 0.1088, 0.0491,
  0.1579, 0.0548, -0.3700, 0.2646,
  // 2010-2019: 강세장
  0.1506, 0.0211, 0.1600, 0.3239, 0.1369, 0.0138,
  0.1196, 0.2183, -0.0438, 0.3149,
  // 2020-2023
  0.1840, 0.2868, -0.1811, 0.2629,
] as const;

/**
 * S&P 500 수익률 데이터의 연도 레이블 (1928~2023)
 */
export const SP500_YEARS: readonly number[] = Array.from(
  { length: SP500_ANNUAL_RETURNS.length },
  (_, i) => 1928 + i
);

// ─────────────────────────────────────────────────────────────────────
// KOSPI 연간 수익률 데이터 (1980–2023)
// ─────────────────────────────────────────────────────────────────────

/**
 * KOSPI 연간 수익률 (소수 표현)
 * 출처: 한국거래소(KRX) / 금융투자협회(KOFIA)
 * 기간: 1980~2023 (44개년)
 */
export const KOSPI_ANNUAL_RETURNS: readonly number[] = [
  // 1980-1989
  0.0516, 0.2467, 0.0549, 0.1164, 0.1383, 0.0772,
  0.0882, 0.9215, 0.7199, 0.1018,
  // 1990-1999: IMF 외환위기 포함
  -0.2344, -0.0874, 0.1067, 0.2799, 0.1855, 0.0278,
  -0.2640, 0.0675, -0.4028, 0.8292,
  // 2000-2009: 닷컴 버블 붕괴, 글로벌 금융위기
  -0.5081, 0.3704, -0.0942, 0.2921, 0.1058, 0.5399,
  0.0394, 0.3218, -0.4047, 0.4951,
  // 2010-2019
  0.2194, -0.1100, 0.0962, 0.0063, -0.0426, 0.0243,
  0.0382, 0.2182, -0.1727, 0.0781,
  // 2020-2023
  0.3056, 0.0364, -0.2447, 0.1887,
] as const;

// ─────────────────────────────────────────────────────────────────────
// 한국 채권 수익률 (대략적 근사, 국고채 3년 기준)
// ─────────────────────────────────────────────────────────────────────

/**
 * 한국 국고채 3년 연간 수익률 근사 (1990~2023)
 * 출처: 한국은행 경제통계시스템(ECOS)
 */
export const KR_BOND_RETURNS: readonly number[] = [
  // 1990-1999
  0.1460, 0.1840, 0.1540, 0.1260, 0.1200, 0.1300,
  0.1200, 0.1385, 0.1515, 0.0823,
  // 2000-2009
  0.0712, 0.0594, 0.0637, 0.0432, 0.0412, 0.0351,
  0.0486, 0.0509, 0.0549, 0.0418,
  // 2010-2019
  0.0331, 0.0354, 0.0342, 0.0278, 0.0246, 0.0193,
  0.0167, 0.0222, 0.0222, 0.0146,
  // 2020-2023
  0.0095, 0.0179, 0.0321, 0.0398,
] as const;

// ─────────────────────────────────────────────────────────────────────
// 혼합 포트폴리오 수익률 계산
// ─────────────────────────────────────────────────────────────────────

export interface PortfolioBlend {
  /** S&P 500 비중 (0~1) */
  sp500Weight: number;
  /** KOSPI 비중 (0~1) */
  kospiWeight: number;
  /** 채권 비중 (0~1) */
  bondWeight: number;
}

/**
 * 주어진 비중으로 혼합 포트폴리오 수익률 배열을 생성합니다.
 * 비중의 합은 반드시 1.0이어야 합니다.
 *
 * 공통 기간(KOSPI 기준 1980~2023)으로 데이터를 정렬합니다.
 *
 * @example
 * // 글로벌 균형 포트폴리오: S&P 500 50%, KOSPI 30%, 채권 20%
 * blendPortfolioReturns({ sp500Weight: 0.5, kospiWeight: 0.3, bondWeight: 0.2 })
 */
export function blendPortfolioReturns(blend: PortfolioBlend): number[] {
  const { sp500Weight, kospiWeight, bondWeight } = blend;
  const totalWeight = sp500Weight + kospiWeight + bondWeight;

  if (Math.abs(totalWeight - 1.0) > 1e-9) {
    throw new RangeError(
      `비중의 합이 1이어야 합니다. 현재: ${totalWeight.toFixed(4)}`
    );
  }

  // 공통 기간: KOSPI는 1980~2023 (44년), 채권은 1990~2023 (34년)
  // S&P 500에서 동일 기간(1990~2023) 슬라이스
  const sp500Start = 1990 - 1928; // index 62
  const sp500Slice = SP500_ANNUAL_RETURNS.slice(sp500Start);

  // 채권 데이터와 KOSPI 데이터의 공통 기간: 1990~2023
  const kospiStart = 1990 - 1980; // index 10
  const kospiSlice = KOSPI_ANNUAL_RETURNS.slice(kospiStart);

  const len = Math.min(sp500Slice.length, kospiSlice.length, KR_BOND_RETURNS.length);

  return Array.from({ length: len }, (_, i) => {
    return (
      sp500Weight * sp500Slice[i] +
      kospiWeight * kospiSlice[i] +
      bondWeight * KR_BOND_RETURNS[i]
    );
  });
}

// ─────────────────────────────────────────────────────────────────────
// 사전 정의 수익률 풀
// ─────────────────────────────────────────────────────────────────────

/**
 * 사전 정의된 수익률 데이터 셋.
 * MonteCarloConfig.historicalReturns에 직접 사용 가능합니다.
 */
export const RETURN_PRESETS = {
  /** S&P 500 전체 기간 (1928~2023, 96년) */
  SP500_FULL: [...SP500_ANNUAL_RETURNS],

  /** S&P 500 최근 50년 (1974~2023) */
  SP500_RECENT_50Y: [...SP500_ANNUAL_RETURNS.slice(-50)],

  /** KOSPI 전체 기간 (1980~2023, 44년) */
  KOSPI_FULL: [...KOSPI_ANNUAL_RETURNS],

  /** 글로벌 균형 포트폴리오 60/40 (S&P 500 40% + KOSPI 20% + 채권 40%) */
  GLOBAL_60_40: blendPortfolioReturns({
    sp500Weight: 0.40,
    kospiWeight: 0.20,
    bondWeight: 0.40,
  }),

  /** 공격형 포트폴리오 (S&P 500 50% + KOSPI 40% + 채권 10%) */
  AGGRESSIVE: blendPortfolioReturns({
    sp500Weight: 0.50,
    kospiWeight: 0.40,
    bondWeight: 0.10,
  }),

  /** 방어형 포트폴리오 (S&P 500 20% + KOSPI 10% + 채권 70%) */
  CONSERVATIVE: blendPortfolioReturns({
    sp500Weight: 0.20,
    kospiWeight: 0.10,
    bondWeight: 0.70,
  }),
} as const;

// ─────────────────────────────────────────────────────────────────────
// Bootstrap 샘플링
// ─────────────────────────────────────────────────────────────────────

/**
 * Bootstrap 방식으로 수익률 배열에서 `years`년치 수익률을 복원 추출합니다.
 *
 * 복원 추출: 같은 수익률이 여러 번 선택될 수 있습니다.
 * 이것은 의도된 동작으로, 역사에 없었던 수익률 시퀀스를 생성합니다.
 *
 * @param pool  - 샘플링 풀 (과거 수익률 배열)
 * @param years - 필요한 연도 수
 * @param rng   - 랜덤 함수 (기본: Math.random)
 * @returns     - `years` 길이의 수익률 배열
 */
export function bootstrapSample(
  pool: readonly number[],
  years: number,
  rng: () => number = Math.random
): number[] {
  if (pool.length === 0) {
    throw new RangeError("수익률 풀이 비어있습니다.");
  }
  return Array.from({ length: years }, () => pool[Math.floor(rng() * pool.length)]);
}

/**
 * Block Bootstrap — 연속된 블록 단위로 샘플링합니다.
 * 단순 Bootstrap보다 시계열 자기상관을 더 잘 보존합니다.
 *
 * @param pool      - 샘플링 풀
 * @param years     - 필요한 연도 수
 * @param blockSize - 블록 크기 (기본: 3년, 단기 경기사이클 포착)
 * @param rng       - 랜덤 함수
 */
export function blockBootstrapSample(
  pool: readonly number[],
  years: number,
  blockSize: number = 3,
  rng: () => number = Math.random
): number[] {
  if (pool.length < blockSize) {
    throw new RangeError(
      `풀 크기(${pool.length})가 블록 크기(${blockSize})보다 작습니다.`
    );
  }

  const result: number[] = [];
  const maxStart = pool.length - blockSize;

  while (result.length < years) {
    const startIdx = Math.floor(rng() * (maxStart + 1));
    for (let i = 0; i < blockSize && result.length < years; i++) {
      result.push(pool[startIdx + i]);
    }
  }

  return result;
}

/**
 * 정규분포 기반 파라메트릭 샘플링 (GBM 근사).
 * 과거 데이터의 평균과 표준편차를 사용하여 수익률을 생성합니다.
 *
 * Box-Muller 변환으로 표준 정규분포를 생성합니다.
 *
 * @param mean   - 연간 평균 수익률 (소수)
 * @param stdDev - 연간 수익률 표준편차 (소수)
 * @param years  - 필요한 연도 수
 * @param rng    - 랜덤 함수
 */
export function parametricSample(
  mean: number,
  stdDev: number,
  years: number,
  rng: () => number = Math.random
): number[] {
  const result: number[] = [];

  for (let i = 0; i < years; i++) {
    // Box-Muller 변환: 균일분포 → 표준정규분포
    const u1 = Math.max(rng(), 1e-15); // log(0) 방지
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    result.push(mean + stdDev * z);
  }

  return result;
}
