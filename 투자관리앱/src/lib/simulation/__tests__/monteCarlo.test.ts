import {
  runMonteCarlo,
  runMonteCarloAsync,
  interpretSurvivalProbability,
  findSafeWithdrawalRate,
  MonteCarloConfig,
} from "../monteCarlo";
import {
  RETURN_PRESETS,
  createSeededRng,
  bootstrapSample,
  blockBootstrapSample,
  parametricSample,
} from "../historicalReturns";

/** 빠른 테스트용 기본 설정 */
const FAST_CONFIG: MonteCarloConfig = {
  initialBalance: 200_000_000,     // 2억원
  annualContribution: 12_000_000,  // 연 1200만원
  accumulationYears: 20,
  retirementYears: 30,
  initialWithdrawalRate: 0.04,
  withdrawalStrategy: "CONSTANT_DOLLAR",
  inflationRate: 0.025,
  historicalReturns: [...RETURN_PRESETS.SP500_FULL],
  numSimulations: 500,             // 테스트 속도 최적화
  seed: 42,                        // 재현 가능
};

describe("runMonteCarlo() — 몬테카를로 시뮬레이션 엔진", () => {
  // ── 기본 동작 ──────────────────────────────────────────────────────
  describe("기본 동작 및 출력 구조", () => {
    it("numSimulations와 일치하는 결과를 반환한다", () => {
      const result = runMonteCarlo(FAST_CONFIG);
      expect(result.numSimulations).toBe(500);
      expect(result.numSurvived + result.numRuined).toBe(500);
    });

    it("생존 확률이 0~100% 범위에 있다", () => {
      const result = runMonteCarlo(FAST_CONFIG);
      expect(result.survivalProbability).toBeGreaterThanOrEqual(0);
      expect(result.survivalProbability).toBeLessThanOrEqual(100);
    });

    it("numSurvived / numSimulations × 100 = survivalProbability", () => {
      const result = runMonteCarlo(FAST_CONFIG);
      const computed = (result.numSurvived / result.numSimulations) * 100;
      expect(result.survivalProbability).toBeCloseTo(computed, 10);
    });

    it("elapsedMs가 기록된다", () => {
      const result = runMonteCarlo(FAST_CONFIG);
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ── 재현성 (시드) ────────────────────────────────────────────────
  describe("재현성 — 동일 시드, 동일 결과", () => {
    it("같은 시드로 두 번 실행하면 동일한 생존 확률이 나온다", () => {
      const result1 = runMonteCarlo({ ...FAST_CONFIG, seed: 12345 });
      const result2 = runMonteCarlo({ ...FAST_CONFIG, seed: 12345 });
      expect(result1.survivalProbability).toBe(result2.survivalProbability);
      expect(result1.numSurvived).toBe(result2.numSurvived);
    });

    it("다른 시드로 실행하면 다른 결과가 나온다", () => {
      const result1 = runMonteCarlo({ ...FAST_CONFIG, seed: 111, numSimulations: 1000 });
      const result2 = runMonteCarlo({ ...FAST_CONFIG, seed: 999, numSimulations: 1000 });
      // 시드가 다르면 결과도 달라야 함 (확률적으로 동일할 수도 있지만 실질적으로 다름)
      expect(result1.survivalProbability).not.toBe(result2.survivalProbability);
    });
  });

  // ── 극단적 시나리오 ───────────────────────────────────────────────
  describe("극단적 시나리오 (결정론적 검증)", () => {
    it("모든 연도 50% 수익률 → 생존 확률 100%", () => {
      const result = runMonteCarlo({
        ...FAST_CONFIG,
        historicalReturns: [0.50], // 50% 수익률만 존재 → 모든 샘플이 50%
      });
      expect(result.survivalProbability).toBe(100);
      expect(result.numRuined).toBe(0);
    });

    it("모든 연도 -50% 수익률 → 생존 확률 0%", () => {
      const result = runMonteCarlo({
        ...FAST_CONFIG,
        historicalReturns: [-0.50], // -50%만 존재 → 모든 시뮬레이션 파산
      });
      expect(result.survivalProbability).toBe(0);
      expect(result.numSurvived).toBe(0);
    });

    it("높은 인출률(20%)은 낮은 인출률(4%)보다 생존 확률이 낮다", () => {
      const lowWithdrawal = runMonteCarlo({
        ...FAST_CONFIG,
        initialWithdrawalRate: 0.04,
      });
      const highWithdrawal = runMonteCarlo({
        ...FAST_CONFIG,
        initialWithdrawalRate: 0.20,
        seed: 42, // 동일 시드
      });
      expect(lowWithdrawal.survivalProbability).toBeGreaterThan(
        highWithdrawal.survivalProbability
      );
    });
  });

  // ── S&P 500 역사 데이터 기반 현실 검증 ───────────────────────────
  describe("S&P 500 데이터 기반 현실 검증 (대수의 법칙)", () => {
    it("4% 룰 + S&P 500 역사 데이터 → 70~100% 생존 확률", () => {
      // 학계 및 업계의 4% 룰 연구 결과와 일치해야 함
      const result = runMonteCarlo({
        ...FAST_CONFIG,
        numSimulations: 2000,
        seed: 42,
      });
      expect(result.survivalProbability).toBeGreaterThan(70);
      expect(result.survivalProbability).toBeLessThanOrEqual(100);
    });

    it("시뮬레이션 수를 늘릴수록 생존 확률이 수렴한다 (LLN)", () => {
      const n500 = runMonteCarlo({ ...FAST_CONFIG, numSimulations: 500, seed: 1 });
      const n2000 = runMonteCarlo({ ...FAST_CONFIG, numSimulations: 2000, seed: 1 });
      const n5000 = runMonteCarlo({ ...FAST_CONFIG, numSimulations: 5000, seed: 1 });
      // 더 많은 시뮬레이션의 결과가 서로 더 가까워야 함
      const diff_500_2000 = Math.abs(n500.survivalProbability - n2000.survivalProbability);
      const diff_2000_5000 = Math.abs(n2000.survivalProbability - n5000.survivalProbability);
      expect(diff_2000_5000).toBeLessThanOrEqual(diff_500_2000 + 5); // 오차 허용
    });
  });

  // ── 백분위 궤적 ────────────────────────────────────────────────────
  describe("percentileTrajectories — 연도별 잔고 분포", () => {
    let result: ReturnType<typeof runMonteCarlo>;

    beforeAll(() => {
      result = runMonteCarlo(FAST_CONFIG);
    });

    it("모든 백분위 궤적의 길이 = totalYears + 1", () => {
      const { p5, p25, p50, p75, p95 } = result.percentileTrajectories;
      const totalYears = FAST_CONFIG.accumulationYears + FAST_CONFIG.retirementYears;
      expect(p5.length).toBe(totalYears + 1);
      expect(p50.length).toBe(totalYears + 1);
      expect(p95.length).toBe(totalYears + 1);
    });

    it("연도 0의 모든 백분위 = 초기 자산 (시작점 동일)", () => {
      const { p5, p50, p95 } = result.percentileTrajectories;
      expect(p5[0]).toBeCloseTo(FAST_CONFIG.initialBalance, -3);
      expect(p50[0]).toBeCloseTo(FAST_CONFIG.initialBalance, -3);
      expect(p95[0]).toBeCloseTo(FAST_CONFIG.initialBalance, -3);
    });

    it("p5 ≤ p25 ≤ p50 ≤ p75 ≤ p95 (단조성)", () => {
      const { p5, p25, p50, p75, p95 } = result.percentileTrajectories;
      const midYear = Math.floor((FAST_CONFIG.accumulationYears + FAST_CONFIG.retirementYears) / 2);
      expect(p5[midYear]).toBeLessThanOrEqual(p25[midYear] + 1);
      expect(p25[midYear]).toBeLessThanOrEqual(p50[midYear] + 1);
      expect(p50[midYear]).toBeLessThanOrEqual(p75[midYear] + 1);
      expect(p75[midYear]).toBeLessThanOrEqual(p95[midYear] + 1);
    });
  });

  // ── 최종 잔고 분포 ────────────────────────────────────────────────
  describe("finalBalanceDistribution", () => {
    it("p5 ≤ median ≤ p95", () => {
      const result = runMonteCarlo(FAST_CONFIG);
      const { p5, median, p95 } = result.finalBalanceDistribution;
      expect(p5).toBeLessThanOrEqual(median + 1);
      expect(median).toBeLessThanOrEqual(p95 + 1);
    });

    it("생존한 경우 중앙값 최종 잔고 > 0", () => {
      const result = runMonteCarlo({
        ...FAST_CONFIG,
        historicalReturns: [0.10], // 항상 10% 수익
      });
      expect(result.finalBalanceDistribution.median).toBeGreaterThan(0);
    });
  });

  // ── 파산 분석 ─────────────────────────────────────────────────────
  describe("ruinYearHistogram — 파산 연도 분포", () => {
    it("생존 100%면 파산 히스토그램이 비어있다", () => {
      const result = runMonteCarlo({
        ...FAST_CONFIG,
        historicalReturns: [0.20], // 모두 생존
      });
      expect(result.ruinYearHistogram.size).toBe(0);
      expect(result.medianRuinYear).toBeUndefined();
    });

    it("파산이 있으면 medianRuinYear가 정의된다", () => {
      const result = runMonteCarlo({
        ...FAST_CONFIG,
        historicalReturns: [-0.20], // 대부분 파산
      });
      expect(result.medianRuinYear).toBeDefined();
    });

    it("파산 연도가 accumulationYears 이후에 발생한다", () => {
      const result = runMonteCarlo({
        ...FAST_CONFIG,
        historicalReturns: [-0.15], // 파산 유도
      });
      for (const [year] of result.ruinYearHistogram) {
        expect(year).toBeGreaterThan(FAST_CONFIG.accumulationYears);
      }
    });
  });

  // ── 진행률 콜백 ────────────────────────────────────────────────────
  describe("onProgress 콜백", () => {
    it("100 단위로 호출되고 최종값이 numSimulations이다", () => {
      const progressCalls: number[] = [];
      runMonteCarlo({
        ...FAST_CONFIG,
        numSimulations: 500,
        onProgress: (done) => progressCalls.push(done),
      });
      expect(progressCalls).toContain(500);
      expect(progressCalls.length).toBe(5); // 100, 200, 300, 400, 500
    });
  });

  // ── 샘플링 방법 비교 ────────────────────────────────────────────────
  describe("샘플링 방법 (Bootstrap vs Block vs Parametric)", () => {
    const baseSamplingConfig = {
      ...FAST_CONFIG,
      numSimulations: 1000,
      seed: 777,
    };

    it("BOOTSTRAP 방식으로 실행된다", () => {
      const result = runMonteCarlo({
        ...baseSamplingConfig,
        samplingMethod: "BOOTSTRAP",
      });
      expect(result.config.samplingMethod).toBe("BOOTSTRAP");
      expect(result.survivalProbability).toBeGreaterThan(0);
    });

    it("BLOCK_BOOTSTRAP 방식으로 실행된다", () => {
      const result = runMonteCarlo({
        ...baseSamplingConfig,
        samplingMethod: "BLOCK_BOOTSTRAP",
        blockSize: 5,
      });
      expect(result.config.samplingMethod).toBe("BLOCK_BOOTSTRAP");
    });

    it("PARAMETRIC 방식으로 실행된다", () => {
      const result = runMonteCarlo({
        ...baseSamplingConfig,
        samplingMethod: "PARAMETRIC",
      });
      expect(result.config.samplingMethod).toBe("PARAMETRIC");
    });
  });
});

// ──────────────────────────────────────────────────────────────────────

describe("runMonteCarloAsync() — 비동기 몬테카를로", () => {
  it("동기 버전과 동일한 구조의 결과를 반환한다 (시드 동일)", async () => {
    const config = { ...FAST_CONFIG, seed: 99, numSimulations: 200 };
    const syncResult = runMonteCarlo(config);
    const asyncResult = await runMonteCarloAsync(config, 50);

    expect(asyncResult.numSimulations).toBe(syncResult.numSimulations);
    // 같은 시드이므로 같은 생존 확률
    expect(asyncResult.survivalProbability).toBe(syncResult.survivalProbability);
  });

  it("onProgress 콜백이 배치마다 호출된다", async () => {
    const calls: number[] = [];
    await runMonteCarloAsync(
      {
        ...FAST_CONFIG,
        numSimulations: 200,
        onProgress: (done) => calls.push(done),
      },
      50 // 배치 크기 50
    );
    // 200 / 50 = 4번 호출
    expect(calls).toHaveLength(4);
    expect(calls[calls.length - 1]).toBe(200);
  });
});

// ──────────────────────────────────────────────────────────────────────

describe("interpretSurvivalProbability() — 결과 해석", () => {
  it("95% 이상 → EXCELLENT", () => {
    expect(interpretSurvivalProbability(97).grade).toBe("EXCELLENT");
  });
  it("85~94% → GOOD", () => {
    expect(interpretSurvivalProbability(90).grade).toBe("GOOD");
  });
  it("75~84% → ACCEPTABLE", () => {
    expect(interpretSurvivalProbability(80).grade).toBe("ACCEPTABLE");
  });
  it("60~74% → RISKY", () => {
    expect(interpretSurvivalProbability(65).grade).toBe("RISKY");
  });
  it("60% 미만 → CRITICAL", () => {
    expect(interpretSurvivalProbability(45).grade).toBe("CRITICAL");
  });
});

// ──────────────────────────────────────────────────────────────────────

describe("샘플링 유틸리티", () => {
  describe("createSeededRng()", () => {
    it("같은 시드 → 같은 시퀀스", () => {
      const rng1 = createSeededRng(42);
      const rng2 = createSeededRng(42);
      for (let i = 0; i < 10; i++) {
        expect(rng1()).toBe(rng2());
      }
    });

    it("[0, 1) 범위의 값을 생성한다", () => {
      const rng = createSeededRng(123);
      for (let i = 0; i < 1000; i++) {
        const v = rng();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  describe("bootstrapSample()", () => {
    it("지정한 길이의 배열을 반환한다", () => {
      const pool = [0.08, -0.05, 0.12, 0.03, -0.15];
      const sample = bootstrapSample(pool, 30, createSeededRng(1));
      expect(sample).toHaveLength(30);
    });

    it("풀에 없는 값은 반환하지 않는다", () => {
      const pool = [0.10, -0.20, 0.05];
      const sample = bootstrapSample(pool, 100, createSeededRng(2));
      for (const v of sample) {
        expect(pool).toContain(v);
      }
    });

    it("빈 풀은 RangeError", () => {
      expect(() => bootstrapSample([], 10)).toThrow(RangeError);
    });
  });

  describe("blockBootstrapSample()", () => {
    it("지정한 길이의 배열을 반환한다", () => {
      const pool = RETURN_PRESETS.SP500_FULL;
      const sample = blockBootstrapSample(pool, 30, 3, createSeededRng(5));
      expect(sample).toHaveLength(30);
    });

    it("풀 크기 < 블록 크기면 RangeError", () => {
      expect(() => blockBootstrapSample([0.1, 0.2], 10, 5)).toThrow(RangeError);
    });
  });

  describe("parametricSample()", () => {
    it("지정한 길이의 배열을 반환한다", () => {
      const sample = parametricSample(0.08, 0.17, 50, createSeededRng(7));
      expect(sample).toHaveLength(50);
    });

    it("대량 샘플의 평균이 설정한 평균에 수렴한다 (LLN)", () => {
      const mean = 0.08;
      const sample = parametricSample(mean, 0.17, 10_000, createSeededRng(9));
      const sampleMean = sample.reduce((s, v) => s + v, 0) / sample.length;
      expect(Math.abs(sampleMean - mean)).toBeLessThan(0.01); // 1% 오차 이내
    });
  });
});

// ──────────────────────────────────────────────────────────────────────

describe("findSafeWithdrawalRate() — 안전 인출률 역산", () => {
  it("목표 생존 확률 90% 달성 인출률이 0%~12% 범위에 있다", () => {
    const { safeRate } = findSafeWithdrawalRate(
      {
        ...FAST_CONFIG,
        numSimulations: 500,
        seed: 42,
      },
      90,
      2.0,    // 2% 허용 오차
      10      // 최대 반복
    );
    expect(safeRate).toBeGreaterThan(0);
    expect(safeRate).toBeLessThan(0.12);
  });
});
