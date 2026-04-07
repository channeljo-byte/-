/**
 * webcrypto.ts — 환경 안전(Environment-Safe) Web Crypto API 접근자
 *
 * 브라우저(window.crypto.subtle)와 Node.js 19+(globalThis.crypto.subtle)
 * 모두에서 동일한 SubtleCrypto 인터페이스를 반환합니다.
 *
 * ⚠️  CryptoJS 등 서드파티 라이브러리는 절대 사용하지 않습니다.
 *      Web Crypto API는 FIPS 140-2 기반 OS 네이티브 RNG를 사용하므로
 *      더 안전하고 성능이 뛰어납니다.
 */

/**
 * 현재 환경의 Crypto 객체를 반환합니다.
 * @throws {Error} Web Crypto API가 지원되지 않는 환경 (HTTP에서 실행된 브라우저 등)
 */
export function getCrypto(): Crypto {
  // Node.js 19+ / 브라우저 모두에서 globalThis.crypto 사용 가능
  const crypto =
    typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (!crypto?.subtle) {
    throw new Error(
      "Web Crypto API(crypto.subtle)를 사용할 수 없습니다.\n" +
        "- 브라우저: HTTPS 또는 localhost에서 실행해야 합니다.\n" +
        "- Node.js: v19 이상이 필요합니다 (현재 환경 확인)."
    );
  }

  return crypto;
}

/**
 * SubtleCrypto 인터페이스를 반환합니다.
 * 모든 암호화 연산의 진입점입니다.
 */
export function getSubtle(): SubtleCrypto {
  return getCrypto().subtle;
}

// ─────────────────────────────────────────────────────────────────────
// 바이너리 변환 유틸리티
// (TextEncoder/TextDecoder 및 Base64 인코딩을 표준화합니다)
// ─────────────────────────────────────────────────────────────────────

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** 문자열 → UTF-8 바이트 배열 */
export function strToBytes(str: string): Uint8Array {
  return encoder.encode(str);
}

/** UTF-8 바이트 배열 → 문자열 */
export function bytesToStr(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/** Uint8Array → Base64url 문자열 (URL-safe, 패딩 없음) */
export function bytesToBase64(bytes: Uint8Array): string {
  // Node.js: Buffer.from().toString('base64url')
  // 브라우저: btoa + 문자 치환
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64url");
  }
  const base64 = btoa(String.fromCharCode(...bytes));
  // base64 → base64url: +→-, /→_, = 제거
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/** Base64url 문자열 → Uint8Array */
export function base64ToBytes(base64url: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64url, "base64url"));
  }
  // base64url → base64: -→+, _→/
  const base64 = base64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), "=");
  const binary = atob(base64);
  return new Uint8Array(binary.split("").map((c) => c.charCodeAt(0)));
}

/**
 * 암호학적으로 안전한 랜덤 바이트를 생성합니다.
 * OS의 CSPRNG를 사용합니다 (window.crypto.getRandomValues).
 */
export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  getCrypto().getRandomValues(bytes);
  return bytes;
}

/**
 * Uint8Array 두 개를 이어붙입니다.
 * IV와 암호문을 단일 blob으로 결합할 때 사용합니다.
 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
