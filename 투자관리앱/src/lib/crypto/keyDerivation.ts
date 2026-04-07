/**
 * keyDerivation.ts — PBKDF2 기반 AES 키 도출 (Key Derivation)
 *
 * 사용자의 마스터 패스워드를 AES-256 CryptoKey로 변환합니다.
 *
 * 알고리즘: PBKDF2-HMAC-SHA-256
 * Salt:    128비트 (16바이트) CSPRNG 랜덤
 * 반복:    600,000회 (OWASP 2023 PBKDF2-SHA-256 최소 권장)
 * 출력:    256비트 AES-GCM 키
 *
 * ─── 왜 PBKDF2인가? ────────────────────────────────────────────────
 * PBKDF2는 의도적으로 느린(cost) KDF로, 브루트포스 공격 시 비용을
 * 선형으로 증가시킵니다. bcrypt/scrypt/Argon2는 Node.js에서
 * Web Crypto API 없이 사용하거나 WASM 번들이 필요해 복잡성이 증가하지만,
 * PBKDF2는 Web Crypto API에 내장되어 있어 추가 의존성 없이 사용 가능합니다.
 * ─────────────────────────────────────────────────────────────────────
 */

import { getSubtle, strToBytes, randomBytes } from "./webcrypto";

/**
 * OWASP 2023: PBKDF2-HMAC-SHA256 최소 권장 반복 횟수
 * 참고: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 */
export const PBKDF2_ITERATIONS = 600_000;

/** PBKDF2 Salt 길이: 128비트 (16바이트) */
export const SALT_LENGTH = 16;

/** AES 키 길이: 256비트 */
const AES_KEY_LENGTH = 256;

export interface DerivedKeyResult {
  /** 암호화/복호화에 사용하는 AES-GCM CryptoKey */
  key: CryptoKey;
  /** 향후 복호화를 위해 저장해야 하는 Salt (base64url 아님, 원시 바이트) */
  salt: Uint8Array;
}

/**
 * 마스터 패스워드에서 AES-256-GCM 키를 도출합니다.
 *
 * 신규 암호화(새 Salt 생성) 또는 기존 데이터 복호화(저장된 Salt 재사용)
 * 모두 이 함수 하나로 처리합니다.
 *
 * @param password - 사용자 마스터 패스워드 (평문)
 * @param salt     - 기존 Salt (복호화 시). 미제공 시 새로 생성합니다 (암호화 시).
 * @param iterations - 반복 횟수 (기본: 600,000). 낮출 경우 보안 수준 저하 주의.
 *
 * @example
 * // 새로 암호화할 때 (Salt 자동 생성)
 * const { key, salt } = await deriveKeyFromPassword("my-secret-password");
 * // salt를 암호문과 함께 저장해야 합니다.
 *
 * @example
 * // 복호화할 때 (저장된 Salt 재사용)
 * const { key } = await deriveKeyFromPassword("my-secret-password", storedSalt);
 */
export async function deriveKeyFromPassword(
  password: string,
  salt?: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<DerivedKeyResult> {
  if (!password) {
    throw new TypeError("패스워드가 비어있습니다.");
  }
  if (iterations < 100_000) {
    console.warn(
      `[Security] PBKDF2 반복 횟수(${iterations})가 OWASP 최소 권장(600,000)보다 낮습니다.`
    );
  }

  const subtle = getSubtle();
  const resolvedSalt = salt ?? randomBytes(SALT_LENGTH);

  // Step 1: 패스워드 문자열을 KeyMaterial로 가져오기
  // importKey("raw")로 패스워드 바이트를 PBKDF2 연산의 기반 키로 만듭니다.
  const keyMaterial = await subtle.importKey(
    "raw",
    strToBytes(password) as unknown as ArrayBuffer,
    { name: "PBKDF2" },
    false, // extractable: false — 키 원본을 외부로 노출하지 않음
    ["deriveKey"]
  );

  // Step 2: PBKDF2로 AES-GCM 키 도출
  const derivedKey = await subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: resolvedSalt as unknown as ArrayBuffer,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: AES_KEY_LENGTH,
    },
    false, // extractable: false — 도출된 키를 외부로 직렬화 불가
    ["encrypt", "decrypt"] // 허용 연산 명시적 제한
  );

  return { key: derivedKey, salt: resolvedSalt };
}

/**
 * 이미 가지고 있는 원시 바이트(raw bytes)로 AES-GCM CryptoKey를 생성합니다.
 * 세션 스토리지나 안전한 채널로 전달받은 키 바이트를 CryptoKey로 변환할 때 사용합니다.
 *
 * ⚠️  일반 암호화 흐름에서는 deriveKeyFromPassword()를 사용하세요.
 *      이 함수는 테스트 또는 특수 목적용입니다.
 */
export async function importRawKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  if (keyBytes.length !== 32) {
    throw new RangeError(
      `AES-256 키는 32바이트여야 합니다. 입력: ${keyBytes.length}바이트`
    );
  }
  return getSubtle().importKey(
    "raw",
    keyBytes as unknown as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}
