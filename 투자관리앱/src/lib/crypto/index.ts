/**
 * Crypto 보안 모듈 — 공개 API
 *
 * 사용 예시:
 *   import { encrypt, decrypt, SecureStorage, investStorage } from "@/lib/crypto";
 */

// 환경 유틸리티 (내부용이지만 테스트 및 고급 사용 시 노출)
export {
  getCrypto,
  getSubtle,
  strToBytes,
  bytesToStr,
  bytesToBase64,
  base64ToBytes,
  randomBytes,
  concatBytes,
} from "./webcrypto";

// 키 도출
export {
  deriveKeyFromPassword,
  importRawKey,
  PBKDF2_ITERATIONS,
  SALT_LENGTH,
} from "./keyDerivation";
export type { DerivedKeyResult } from "./keyDerivation";

// AES-GCM 암/복호화 (고수준: 패스워드 기반)
export { encrypt, decrypt, encryptObject, decryptObject } from "./aesGcm";

// AES-GCM 암/복호화 (저수준: CryptoKey 직접 사용 — 세션 키 시나리오)
export {
  encryptWithKey,
  decryptWithKey,
  encryptObjectWithKey,
  decryptObjectWithKey,
  IV_LENGTH,
} from "./aesGcm";

// 암호화된 localStorage 래퍼
export { SecureStorage, investStorage } from "./secureStorage";
export type { StorageStatus, UnlockOptions } from "./secureStorage";
