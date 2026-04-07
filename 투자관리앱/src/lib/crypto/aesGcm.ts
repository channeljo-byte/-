/**
 * aesGcm.ts — AES-256-GCM 인증 암호화(AEAD) 모듈
 *
 * ─── 왜 AES-GCM인가? ────────────────────────────────────────────────
 * AES-GCM은 AEAD(Authenticated Encryption with Associated Data) 방식으로,
 * 암호화와 무결성 검증을 동시에 수행합니다.
 * - 기밀성: AES-256 (256비트 키)
 * - 인증:   GHASH 기반 128비트 인증 태그
 *            → 변조된 암호문은 복호화 즉시 탐지됩니다.
 * - CBC+HMAC, CTR 등 인증 없는 모드는 사용하지 않습니다.
 * ─────────────────────────────────────────────────────────────────────
 *
 * ─── 암호문 Blob 포맷 ────────────────────────────────────────────────
 *
 * [CryptoKey 기반 암호화 (IV만 포함)]
 * ┌─────────┬────────────────────────────────┐
 * │  IV     │  ciphertext + GCM tag (128-bit)│
 * │ 12 bytes│  variable bytes + 16 bytes     │
 * └─────────┴────────────────────────────────┘
 *
 * [패스워드 기반 암호화 (버전 + Salt + iterations + IV 포함)]
 * ┌─────────┬────────────┬──────────────┬─────────┬──────────────────────────────────┐
 * │ version │   salt     │  iterations  │   IV    │  ciphertext + GCM tag (128-bit)  │
 * │  1 byte │  16 bytes  │   4 bytes    │ 12 bytes│  variable bytes + 16 bytes       │
 * └─────────┴────────────┴──────────────┴─────────┴──────────────────────────────────┘
 * iterations를 blob에 포함하여 encrypt/decrypt가 항상 동일한 반복 횟수를 사용하도록 보장합니다.
 *
 * 전체 blob은 Base64url로 인코딩되어 localStorage/DB에 저장됩니다.
 * ─────────────────────────────────────────────────────────────────────
 */

import {
  getSubtle,
  strToBytes,
  bytesToStr,
  bytesToBase64,
  base64ToBytes,
  randomBytes,
  concatBytes,
} from "./webcrypto";
import {
  deriveKeyFromPassword,
  SALT_LENGTH,
  PBKDF2_ITERATIONS,
} from "./keyDerivation";

/** IV 길이: 96비트 (12바이트) — GCM 표준 권장값 */
export const IV_LENGTH = 12;

/** GCM 인증 태그 길이: 128비트 (16바이트) */
const TAG_LENGTH = 128;

/**
 * 포맷 버전 바이트.
 * 알고리즘 변경 시 이전 데이터도 올바르게 복호화할 수 있도록 합니다.
 * v1: PBKDF2-SHA256 + AES-256-GCM (iterations는 blob 내 4바이트로 자기서술)
 */
const FORMAT_VERSION_V1 = 0x01;

/** iterations를 4바이트 big-endian으로 직렬화 */
function iterationsToBytes(iterations: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, iterations, false /* big-endian */);
  return buf;
}

/** 4바이트 big-endian → iterations 숫자 */
function bytesToIterations(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false);
}

// ─────────────────────────────────────────────────────────────────────
// 저수준 AES-GCM 암/복호화 (CryptoKey 직접 사용)
// ─────────────────────────────────────────────────────────────────────

/**
 * [저수준] CryptoKey로 문자열을 AES-256-GCM 암호화합니다.
 *
 * 매 호출마다 고유한 96비트 IV를 생성하여 암호문 앞에 붙입니다.
 * 같은 키와 같은 평문이라도 호출마다 다른 암호문이 생성됩니다.
 *
 * @param plaintext - 암호화할 평문 문자열
 * @param key       - 사전 도출된 AES-GCM CryptoKey
 * @returns         - Base64url 인코딩된 [IV(12) + ciphertext+tag] 문자열
 */
export async function encryptWithKey(
  plaintext: string,
  key: CryptoKey
): Promise<string> {
  const subtle = getSubtle();
  const iv = randomBytes(IV_LENGTH) as unknown as Uint8Array<ArrayBuffer>; // 96비트 랜덤 IV, 절대 재사용하지 않음

  const cipherBuffer = await subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: TAG_LENGTH },
    key,
    strToBytes(plaintext) as unknown as ArrayBuffer
  );

  // IV + ciphertext+tag 결합 → Base64url
  const blob = concatBytes(iv, new Uint8Array(cipherBuffer));
  return bytesToBase64(blob);
}

/**
 * [저수준] CryptoKey로 AES-256-GCM 암호문을 복호화합니다.
 *
 * @param encoded - Base64url 인코딩된 [IV(12) + ciphertext+tag] 문자열
 * @param key     - 암호화에 사용한 것과 동일한 AES-GCM CryptoKey
 * @returns       - 복호화된 평문 문자열
 * @throws {DOMException} 키가 틀리거나 데이터가 변조된 경우 (GCM 태그 불일치)
 */
export async function decryptWithKey(
  encoded: string,
  key: CryptoKey
): Promise<string> {
  const subtle = getSubtle();
  const blob = base64ToBytes(encoded);

  if (blob.length < IV_LENGTH + 16) {
    throw new RangeError(
      `암호문이 너무 짧습니다. 최소 ${IV_LENGTH + 16}바이트 필요, 입력: ${blob.length}바이트`
    );
  }

  // blob에서 IV와 ciphertext+tag 분리
  const iv = blob.slice(0, IV_LENGTH);
  const ciphertext = blob.slice(IV_LENGTH);

  const plainBuffer = await subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: TAG_LENGTH },
    key,
    ciphertext
  );

  return bytesToStr(new Uint8Array(plainBuffer));
}

// ─────────────────────────────────────────────────────────────────────
// 고수준 패스워드 기반 암/복호화 (Salt + IV 자동 포함)
// ─────────────────────────────────────────────────────────────────────

/**
 * [고수준] 마스터 패스워드로 문자열을 암호화합니다.
 *
 * 내부적으로 PBKDF2로 키를 도출하고 AES-256-GCM으로 암호화합니다.
 * Salt와 IV가 암호문 앞에 자동으로 포함되므로,
 * 복호화 시 패스워드만 있으면 됩니다.
 *
 * @param plaintext  - 암호화할 평문
 * @param password   - 마스터 패스워드
 * @param iterations - PBKDF2 반복 횟수 (기본: 600,000)
 * @returns          - Self-contained Base64url 암호문
 *                     (version + salt + IV + ciphertext+tag)
 *
 * @example
 * const blob = await encrypt("민감한 자산 데이터", "my-master-password");
 * // → "AQAA...base64url..." (localStorage에 저장)
 */
export async function encrypt(
  plaintext: string,
  password: string,
  iterations?: number
): Promise<string> {
  const subtle = getSubtle();
  const { key, salt } = await deriveKeyFromPassword(
    password,
    undefined, // 새로운 Salt 자동 생성
    iterations
  );

  const iv = randomBytes(IV_LENGTH) as unknown as Uint8Array<ArrayBuffer>;

  const cipherBuffer = await subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: TAG_LENGTH },
    key,
    strToBytes(plaintext) as unknown as ArrayBuffer
  );

  // 버전(1) + Salt(16) + iterations(4 big-endian) + IV(12) + ciphertext+tag(n+16)
  // iterations를 blob에 포함하여 복호화 시 동일한 반복 횟수를 자동 복원합니다.
  const versionByte = new Uint8Array([FORMAT_VERSION_V1]);
  const resolvedIterations = iterations ?? PBKDF2_ITERATIONS;
  const blob = concatBytes(
    versionByte,
    salt,
    iterationsToBytes(resolvedIterations),
    iv,
    new Uint8Array(cipherBuffer)
  );

  return bytesToBase64(blob);
}

/**
 * [고수준] 마스터 패스워드로 암호문을 복호화합니다.
 *
 * @param encoded  - encrypt()가 반환한 Base64url 암호문
 * @param password - 암호화에 사용한 마스터 패스워드
 * @returns        - 복호화된 평문 문자열
 * @throws {Error}       버전 불일치
 * @throws {RangeError}  암호문 길이 이상
 * @throws {DOMException} 패스워드 틀림 또는 데이터 변조 (GCM 태그 불일치)
 */
export async function decrypt(
  encoded: string,
  password: string
): Promise<string> {
  const subtle = getSubtle();
  const blob = base64ToBytes(encoded);

  // 최소 길이: version(1) + salt(16) + iterations(4) + IV(12) + tag(16) = 49바이트
  const MIN_LENGTH = 1 + SALT_LENGTH + 4 + IV_LENGTH + 16;
  if (blob.length < MIN_LENGTH) {
    throw new RangeError(
      `암호문이 유효하지 않습니다. 최소 ${MIN_LENGTH}바이트 필요, 입력: ${blob.length}바이트`
    );
  }

  // 포맷 파싱
  const version = blob[0];
  if (version !== FORMAT_VERSION_V1) {
    throw new Error(
      `지원하지 않는 암호문 버전: 0x${version.toString(16).padStart(2, "0")}`
    );
  }

  let offset = 1;
  const salt = blob.slice(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;
  // blob에서 암호화 시 사용한 iterations를 복원 (encrypt/decrypt 파라미터 불일치 방지)
  const storedIterations = bytesToIterations(blob, offset);
  offset += 4;
  const iv = blob.slice(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;
  const ciphertext = blob.slice(offset);

  // 저장된 Salt + 저장된 iterations로 동일한 키 재도출
  const { key } = await deriveKeyFromPassword(password, salt, storedIterations);

  const plainBuffer = await subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: TAG_LENGTH },
    key,
    ciphertext
  );

  return bytesToStr(new Uint8Array(plainBuffer));
}

// ─────────────────────────────────────────────────────────────────────
// 객체 암/복호화 헬퍼
// ─────────────────────────────────────────────────────────────────────

/**
 * JSON 직렬화 가능한 객체를 패스워드로 암호화합니다.
 */
export async function encryptObject<T>(
  obj: T,
  password: string,
  iterations?: number
): Promise<string> {
  return encrypt(JSON.stringify(obj), password, iterations);
}

/**
 * 암호화된 문자열을 복호화하여 객체로 반환합니다.
 */
export async function decryptObject<T>(
  encoded: string,
  password: string
): Promise<T> {
  const json = await decrypt(encoded, password);
  return JSON.parse(json) as T;
}

/**
 * CryptoKey로 JSON 직렬화 가능한 객체를 암호화합니다. (세션 키 사용 시)
 */
export async function encryptObjectWithKey<T>(
  obj: T,
  key: CryptoKey
): Promise<string> {
  return encryptWithKey(JSON.stringify(obj), key);
}

/**
 * CryptoKey로 암호화된 문자열을 복호화하여 객체로 반환합니다. (세션 키 사용 시)
 */
export async function decryptObjectWithKey<T>(
  encoded: string,
  key: CryptoKey
): Promise<T> {
  const json = await decryptWithKey(encoded, key);
  return JSON.parse(json) as T;
}
