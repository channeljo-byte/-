/**
 * AES-GCM 암/복호화 테스트
 *
 * 테스트 속도를 위해 PBKDF2 반복 횟수를 낮춥니다.
 */
import {
  encrypt,
  decrypt,
  encryptWithKey,
  decryptWithKey,
  encryptObject,
  decryptObject,
  encryptObjectWithKey,
  decryptObjectWithKey,
  IV_LENGTH,
} from "../aesGcm";
import { deriveKeyFromPassword } from "../keyDerivation";
import { base64ToBytes } from "../webcrypto";

const TEST_ITERATIONS = 1_000;
const TEST_PASSWORD = "investment-master-password-2024";

describe("저수준 AES-GCM (CryptoKey 직접 사용)", () => {
  let key: CryptoKey;

  beforeAll(async () => {
    const { key: k } = await deriveKeyFromPassword(
      TEST_PASSWORD,
      undefined,
      TEST_ITERATIONS
    );
    key = k;
  });

  // ── encryptWithKey ──────────────────────────────────────────────────
  describe("encryptWithKey()", () => {
    it("암호화 결과가 Base64url 문자열이어야 한다", async () => {
      const result = await encryptWithKey("Hello, World!", key);
      expect(typeof result).toBe("string");
      // Base64url 문자셋만 포함 (= 없음, +/없음)
      expect(result).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    it("동일한 평문도 호출마다 다른 암호문이 생성된다 (IV 랜덤성)", async () => {
      const plaintext = "비밀 자산 데이터";
      const cipher1 = await encryptWithKey(plaintext, key);
      const cipher2 = await encryptWithKey(plaintext, key);
      expect(cipher1).not.toBe(cipher2);
    });

    it("암호문 길이: IV(12) + plaintext bytes + tag(16) 이상이어야 한다", async () => {
      const plaintext = "test";
      const encoded = await encryptWithKey(plaintext, key);
      const bytes = base64ToBytes(encoded);
      const plaintextBytes = new TextEncoder().encode(plaintext).length;
      // IV(12) + plaintext + GCM_TAG(16)
      expect(bytes.length).toBe(IV_LENGTH + plaintextBytes + 16);
    });

    it("빈 문자열도 암호화 가능하다", async () => {
      const encrypted = await encryptWithKey("", key);
      const decrypted = await decryptWithKey(encrypted, key);
      expect(decrypted).toBe("");
    });

    it("한글, 이모지 등 멀티바이트 문자를 처리한다", async () => {
      const original = "투자관리 💰 포트폴리오 🚀";
      const encrypted = await encryptWithKey(original, key);
      const decrypted = await decryptWithKey(encrypted, key);
      expect(decrypted).toBe(original);
    });
  });

  // ── decryptWithKey ──────────────────────────────────────────────────
  describe("decryptWithKey()", () => {
    it("암호화 → 복호화 왕복이 완벽하게 일치해야 한다", async () => {
      const original = "삼성전자 100주 @ 72,000원";
      const encrypted = await encryptWithKey(original, key);
      const decrypted = await decryptWithKey(encrypted, key);
      expect(decrypted).toBe(original);
    });

    it("잘못된 키로 복호화하면 DOMException이 발생한다 (GCM 태그 인증 실패)", async () => {
      const encrypted = await encryptWithKey("secret data", key);

      const { key: wrongKey } = await deriveKeyFromPassword(
        "completely-different-password",
        undefined,
        TEST_ITERATIONS
      );

      await expect(decryptWithKey(encrypted, wrongKey)).rejects.toThrow();
    });

    it("암호문 1비트 변조 시 복호화가 실패한다 (무결성 보장)", async () => {
      const encrypted = await encryptWithKey("tamper test", key);
      const bytes = base64ToBytes(encrypted);

      // 마지막 바이트를 변조
      bytes[bytes.length - 1] ^= 0xff;

      const { bytesToBase64 } = await import("../webcrypto");
      const tampered = bytesToBase64(bytes);

      await expect(decryptWithKey(tampered, key)).rejects.toThrow();
    });

    it("짧은 암호문은 RangeError를 발생시킨다", async () => {
      // IV(12) + tag(16) 미만의 데이터
      const { bytesToBase64 } = await import("../webcrypto");
      const tooShort = bytesToBase64(new Uint8Array(10));
      await expect(decryptWithKey(tooShort, key)).rejects.toThrow(RangeError);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────

describe("고수준 패스워드 기반 AES-GCM", () => {
  // ── encrypt ─────────────────────────────────────────────────────────
  describe("encrypt()", () => {
    it("Self-contained 암호문을 반환한다 (Salt + iterations + IV 포함)", async () => {
      const blob = await encrypt("portfolio data", TEST_PASSWORD, TEST_ITERATIONS);
      expect(typeof blob).toBe("string");
      // version(1) + salt(16) + iterations(4) + iv(12) + data(n) + tag(16) → 최소 49바이트
      const bytes = base64ToBytes(blob);
      expect(bytes.length).toBeGreaterThanOrEqual(49);
    });

    it("버전 바이트가 0x01이어야 한다", async () => {
      const blob = await encrypt("test", TEST_PASSWORD, TEST_ITERATIONS);
      const bytes = base64ToBytes(blob);
      expect(bytes[0]).toBe(0x01); // FORMAT_VERSION_V1
    });

    it("동일한 평문 + 패스워드라도 매번 다른 암호문이 생성된다", async () => {
      const blob1 = await encrypt("same text", TEST_PASSWORD, TEST_ITERATIONS);
      const blob2 = await encrypt("same text", TEST_PASSWORD, TEST_ITERATIONS);
      expect(blob1).not.toBe(blob2); // Salt와 IV가 다르므로 항상 다름
    });
  });

  // ── decrypt ─────────────────────────────────────────────────────────
  describe("decrypt()", () => {
    it("암호화 → 복호화 왕복 (패스워드 기반)", async () => {
      const original = "비밀 포트폴리오: BTC 0.5, ETH 3.2, 삼성전자 200주";
      const blob = await encrypt(original, TEST_PASSWORD, TEST_ITERATIONS);
      const decrypted = await decrypt(blob, TEST_PASSWORD);
      expect(decrypted).toBe(original);
    });

    it("틀린 패스워드로 복호화하면 오류가 발생한다", async () => {
      const blob = await encrypt("confidential", TEST_PASSWORD, TEST_ITERATIONS);
      await expect(decrypt(blob, "wrong-password")).rejects.toThrow();
    });

    it("올바른 패스워드로 재시도하면 성공한다", async () => {
      const original = "retry test";
      const blob = await encrypt(original, TEST_PASSWORD, TEST_ITERATIONS);

      // 틀린 패스워드
      await expect(decrypt(blob, "wrong")).rejects.toThrow();

      // 올바른 패스워드
      const result = await decrypt(blob, TEST_PASSWORD);
      expect(result).toBe(original);
    });

    it("너무 짧은 암호문은 RangeError를 발생시킨다", async () => {
      const { bytesToBase64 } = await import("../webcrypto");
      const tooShort = bytesToBase64(new Uint8Array(10));
      await expect(decrypt(tooShort, TEST_PASSWORD)).rejects.toThrow(RangeError);
    });

    it("지원하지 않는 버전 바이트는 오류를 발생시킨다", async () => {
      const { bytesToBase64 } = await import("../webcrypto");
      // version = 0x02 (미지원)
      const invalidVersion = new Uint8Array(50).fill(0);
      invalidVersion[0] = 0x02;
      const encoded = bytesToBase64(invalidVersion);
      await expect(decrypt(encoded, TEST_PASSWORD)).rejects.toThrow(
        /버전/
      );
    });
  });

  // ── 대용량 데이터 ────────────────────────────────────────────────────
  describe("대용량 데이터 처리", () => {
    it("1MB 데이터도 올바르게 암/복호화한다", async () => {
      const largeData = "A".repeat(1024 * 1024); // 1MB
      const blob = await encrypt(largeData, TEST_PASSWORD, TEST_ITERATIONS);
      const decrypted = await decrypt(blob, TEST_PASSWORD);
      expect(decrypted).toBe(largeData);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────

describe("객체 암/복호화 헬퍼", () => {
  let key: CryptoKey;

  beforeAll(async () => {
    const { key: k } = await deriveKeyFromPassword(
      TEST_PASSWORD,
      undefined,
      TEST_ITERATIONS
    );
    key = k;
  });

  it("encryptObject / decryptObject — 패스워드 기반 왕복", async () => {
    const original = {
      portfolio: [
        { ticker: "AAPL", quantity: 10, avgPrice: 180.5 },
        { ticker: "005930", quantity: 100, avgPrice: 72000 },
      ],
      totalValue: 3_880_000,
      currency: "KRW",
    };

    const encrypted = await encryptObject(original, TEST_PASSWORD, TEST_ITERATIONS);
    const decrypted = await decryptObject<typeof original>(
      encrypted,
      TEST_PASSWORD
    );

    expect(decrypted).toEqual(original);
  });

  it("encryptObjectWithKey / decryptObjectWithKey — CryptoKey 기반 왕복", async () => {
    const original = { secret: "비밀 정보", amount: 1_000_000 };

    const encrypted = await encryptObjectWithKey(original, key);
    const decrypted = await decryptObjectWithKey<typeof original>(
      encrypted,
      key
    );

    expect(decrypted).toEqual(original);
  });

  it("null, 숫자, 배열 등 다양한 타입을 처리한다", async () => {
    const testCases = [null, 42, true, [1, 2, 3], "단순 문자열"];

    for (const value of testCases) {
      const encrypted = await encryptObjectWithKey(value, key);
      const decrypted = await decryptObjectWithKey(encrypted, key);
      expect(decrypted).toEqual(value);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────

describe("IV 고유성 보장 (통계 검증)", () => {
  it("1,000번 암호화 시 모든 IV가 고유해야 한다", async () => {
    const { key } = await deriveKeyFromPassword(
      TEST_PASSWORD,
      undefined,
      TEST_ITERATIONS
    );

    const N = 1_000;
    const ivSet = new Set<string>();

    for (let i = 0; i < N; i++) {
      const encrypted = await encryptWithKey("test", key);
      const bytes = base64ToBytes(encrypted);
      const iv = Buffer.from(bytes.slice(0, IV_LENGTH)).toString("hex");
      ivSet.add(iv);
    }

    // 모든 IV가 고유해야 함
    expect(ivSet.size).toBe(N);
  });
});
