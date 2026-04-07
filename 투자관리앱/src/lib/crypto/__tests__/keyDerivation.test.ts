/**
 * keyDerivation 테스트
 *
 * Node.js 19+ globalThis.crypto (Web Crypto API)를 사용합니다.
 * 테스트 속도를 위해 PBKDF2 반복 횟수를 의도적으로 낮춥니다.
 * 프로덕션에서는 반드시 PBKDF2_ITERATIONS(600,000)을 사용하세요.
 */
import { deriveKeyFromPassword, importRawKey, SALT_LENGTH } from "../keyDerivation";

/** 테스트 전용 낮은 반복 횟수 (속도 우선) */
const TEST_ITERATIONS = 1_000;

describe("deriveKeyFromPassword (PBKDF2 키 도출)", () => {
  // ── 기본 동작 ──────────────────────────────────────────────────────
  describe("기본 키 도출", () => {
    it("유효한 패스워드로 CryptoKey를 반환한다", async () => {
      const { key, salt } = await deriveKeyFromPassword(
        "test-password",
        undefined,
        TEST_ITERATIONS
      );
      expect(key).toBeDefined();
      expect(key.type).toBe("secret");
      expect(key.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(SALT_LENGTH); // 16바이트
    });

    it("키는 extractable: false 여야 한다 (외부 노출 불가)", async () => {
      const { key } = await deriveKeyFromPassword(
        "secure-password",
        undefined,
        TEST_ITERATIONS
      );
      expect(key.extractable).toBe(false);
    });

    it("키 사용 용도가 encrypt/decrypt만 허용된다", async () => {
      const { key } = await deriveKeyFromPassword(
        "password",
        undefined,
        TEST_ITERATIONS
      );
      expect(key.usages).toEqual(expect.arrayContaining(["encrypt", "decrypt"]));
      expect(key.usages).not.toContain("sign");
      expect(key.usages).not.toContain("wrapKey");
    });

    it("Salt가 자동 생성될 때 16바이트 랜덤값이어야 한다", async () => {
      const { salt: salt1 } = await deriveKeyFromPassword(
        "same-password",
        undefined,
        TEST_ITERATIONS
      );
      const { salt: salt2 } = await deriveKeyFromPassword(
        "same-password",
        undefined,
        TEST_ITERATIONS
      );
      // 같은 패스워드라도 Salt가 다르면 다른 키가 도출됩니다
      expect(Buffer.from(salt1).toString("hex")).not.toBe(
        Buffer.from(salt2).toString("hex")
      );
    });
  });

  // ── Salt 재사용 — 결정론적 키 도출 ───────────────────────────────
  describe("Salt 재사용 (결정론적 복호화)", () => {
    it("동일한 패스워드 + 동일한 Salt → 동일한 키를 도출해야 한다", async () => {
      const password = "deterministic-password";
      const { key: key1, salt } = await deriveKeyFromPassword(
        password,
        undefined,
        TEST_ITERATIONS
      );

      // 저장된 Salt로 재도출
      const { key: key2 } = await deriveKeyFromPassword(
        password,
        salt,
        TEST_ITERATIONS
      );

      // CryptoKey를 직접 비교할 수 없으므로, 두 키로 암/복호화 교차 테스트
      const testData = new TextEncoder().encode("cross-verify-test");
      const iv = new Uint8Array(12).fill(1);

      const ciphertext = await globalThis.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key1,
        testData
      );

      const plaintext = await globalThis.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key2,
        ciphertext
      );

      expect(new TextDecoder().decode(plaintext)).toBe("cross-verify-test");
    });

    it("다른 패스워드 + 동일한 Salt → 다른 키를 도출해야 한다", async () => {
      const { salt } = await deriveKeyFromPassword(
        "password-A",
        undefined,
        TEST_ITERATIONS
      );

      const { key: keyA } = await deriveKeyFromPassword(
        "password-A",
        salt,
        TEST_ITERATIONS
      );
      const { key: keyB } = await deriveKeyFromPassword(
        "password-B",
        salt,
        TEST_ITERATIONS
      );

      // keyB로 keyA가 암호화한 데이터를 복호화하면 오류가 발생해야 함
      const testData = new TextEncoder().encode("secret");
      const iv = new Uint8Array(12).fill(2);

      const ciphertext = await globalThis.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        keyA,
        testData
      );

      await expect(
        globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv }, keyB, ciphertext)
      ).rejects.toThrow();
    });
  });

  // ── 오류 처리 ─────────────────────────────────────────────────────
  describe("오류 처리", () => {
    it("빈 패스워드는 TypeError를 발생시킨다", async () => {
      await expect(
        deriveKeyFromPassword("", undefined, TEST_ITERATIONS)
      ).rejects.toThrow(TypeError);
    });

    it("낮은 반복 횟수는 경고를 발생시킨다 (오류는 아님)", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
      await deriveKeyFromPassword("password", undefined, 50_000);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("OWASP")
      );
      consoleSpy.mockRestore();
    });
  });
});

// ──────────────────────────────────────────────────────────────────────

describe("importRawKey (원시 바이트 → CryptoKey)", () => {
  it("32바이트 키 → AES-GCM CryptoKey 변환", async () => {
    const rawKey = new Uint8Array(32).fill(0xab);
    const key = await importRawKey(rawKey);
    expect(key.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
    expect(key.extractable).toBe(false);
  });

  it("32바이트가 아닌 입력은 RangeError", async () => {
    await expect(importRawKey(new Uint8Array(16))).rejects.toThrow(RangeError);
    await expect(importRawKey(new Uint8Array(64))).rejects.toThrow(RangeError);
  });
});
