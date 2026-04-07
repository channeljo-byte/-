/**
 * secureStorage.ts — 암호화된 브라우저 스토리지 래퍼
 *
 * localStorage에 평문 데이터가 저장되지 않도록 모든 데이터를
 * AES-256-GCM으로 암호화한 후 저장합니다.
 *
 * ─── 보안 설계 원칙 ──────────────────────────────────────────────────
 * 1. 도출된 CryptoKey는 메모리에만 보관 (localStorage/sessionStorage 저장 금지)
 * 2. 페이지 언로드 시 키가 자동으로 소멸 (GC가 수행)
 * 3. 각 아이템은 독립적인 IV로 암호화 (동일 데이터도 다른 암호문)
 * 4. 키 없이는 localStorage 내용을 복호화할 수 없음
 * 5. 잠금(lock) 상태에서는 어떤 쓰기/읽기도 차단
 * ─────────────────────────────────────────────────────────────────────
 */

import { encryptWithKey, decryptWithKey } from "./aesGcm";
import {
  deriveKeyFromPassword,
  SALT_LENGTH,
  PBKDF2_ITERATIONS,
} from "./keyDerivation";
import {
  bytesToBase64,
  base64ToBytes,
  randomBytes,
} from "./webcrypto";

// ─────────────────────────────────────────────────────────────────────
// 상수 및 타입
// ─────────────────────────────────────────────────────────────────────

/**
 * localStorage에 Salt를 저장할 키.
 * Salt는 민감하지 않습니다 — 키 도출 시 패스워드와 함께 사용되어야만 의미가 있습니다.
 */
const SALT_STORAGE_KEY = "__secure_storage_salt__";

/** 모든 암호화 아이템에 붙이는 키 접두사. 일반 localStorage 항목과 구분합니다. */
const ITEM_PREFIX = "__enc__";

/** 잠금 해제 여부를 나타내는 타입 */
export type StorageStatus = "locked" | "unlocked";

/** 잠금 해제 옵션 */
export interface UnlockOptions {
  /**
   * PBKDF2 반복 횟수 오버라이드 (기본: 600,000)
   * 테스트 목적으로만 낮추세요. 프로덕션에서는 기본값을 유지하세요.
   */
  iterations?: number;
}

// ─────────────────────────────────────────────────────────────────────
// SecureStorage 클래스
// ─────────────────────────────────────────────────────────────────────

/**
 * 암호화된 localStorage 래퍼.
 *
 * @example
 * const storage = new SecureStorage();
 * await storage.unlock("my-master-password");
 *
 * await storage.setItem("portfolio", { stocks: [...], crypto: [...] });
 * const data = await storage.getItem<Portfolio>("portfolio");
 *
 * storage.lock(); // 탭 닫기, 로그아웃 시 호출
 */
export class SecureStorage {
  /** 메모리에만 보관되는 세션 키 (localStorage에 절대 저장하지 않음) */
  private _key: CryptoKey | null = null;
  private readonly _namespace: string;
  /** 현재 세션에서 unlock()에 사용된 PBKDF2 반복 횟수. changePassword에 동일하게 적용됩니다. */
  private _iterations: number = PBKDF2_ITERATIONS;

  /**
   * @param namespace - 여러 SecureStorage 인스턴스를 격리할 네임스페이스.
   *                    같은 앱의 다른 기능은 다른 네임스페이스를 사용하세요.
   */
  constructor(namespace: string = "default") {
    this._namespace = namespace;

    // 브라우저: 페이지 언로드 시 자동 잠금
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => this.lock());
    }
  }

  // ── 상태 ────────────────────────────────────────────────────────────

  get status(): StorageStatus {
    return this._key !== null ? "unlocked" : "locked";
  }

  get isUnlocked(): boolean {
    return this._key !== null;
  }

  // ── 잠금 해제 / 잠금 ────────────────────────────────────────────────

  /**
   * 마스터 패스워드로 스토리지를 잠금 해제합니다.
   *
   * 내부적으로 PBKDF2를 실행하여 세션 키를 도출합니다.
   * Salt는 localStorage에 저장되며, 키는 메모리에만 보관됩니다.
   *
   * @param password - 마스터 패스워드
   * @param options  - 선택적 설정
   * @throws {TypeError} 패스워드가 비어있는 경우
   */
  async unlock(password: string, options: UnlockOptions = {}): Promise<void> {
    const iterations = options.iterations ?? PBKDF2_ITERATIONS;

    // 기존 Salt 불러오기 (없으면 새로 생성)
    const existingSaltB64 = this._getFromStorage(SALT_STORAGE_KEY);
    const existingSalt = existingSaltB64
      ? base64ToBytes(existingSaltB64)
      : undefined;

    const { key, salt } = await deriveKeyFromPassword(
      password,
      existingSalt,
      iterations
    );

    // Salt 저장 (평문이므로 일반 localStorage에 저장 가능)
    if (!existingSaltB64) {
      this._saveToStorage(SALT_STORAGE_KEY, bytesToBase64(salt));
    }

    this._key = key;
    this._iterations = iterations; // changePassword 시 동일한 iterations 재사용
  }

  /**
   * 스토리지를 잠급니다. 메모리의 세션 키를 즉시 파기합니다.
   * 잠금 후에는 setItem/getItem 호출이 모두 오류를 발생시킵니다.
   */
  lock(): void {
    this._key = null;
  }

  /**
   * Salt를 초기화하고 잠급니다.
   * 패스워드를 변경하거나 모든 데이터를 삭제할 때 사용합니다.
   * ⚠️  이 메서드를 호출하면 기존 암호화 데이터는 복구 불가능합니다.
   */
  reset(): void {
    this.lock();
    this._removeFromStorage(SALT_STORAGE_KEY);
  }

  // ── 데이터 접근 ─────────────────────────────────────────────────────

  /**
   * 값을 암호화하여 localStorage에 저장합니다.
   *
   * @param key   - 스토리지 키 (사람이 읽을 수 있는 식별자)
   * @param value - 저장할 값 (JSON 직렬화 가능한 모든 타입)
   * @throws {Error} 잠금 상태에서 호출 시
   */
  async setItem<T>(key: string, value: T): Promise<void> {
    this._requireUnlocked();
    const plaintext = JSON.stringify(value);
    const encrypted = await encryptWithKey(plaintext, this._key!);
    this._saveToStorage(this._prefixedKey(key), encrypted);
  }

  /**
   * 복호화하여 값을 반환합니다.
   *
   * @param key - 스토리지 키
   * @returns 복호화된 값, 또는 키가 없으면 null
   * @throws {Error}       잠금 상태에서 호출 시
   * @throws {DOMException} 잘못된 키로 복호화 시도 시 (GCM 태그 불일치)
   */
  async getItem<T>(key: string): Promise<T | null> {
    this._requireUnlocked();
    const encrypted = this._getFromStorage(this._prefixedKey(key));
    if (encrypted === null) return null;
    const plaintext = await decryptWithKey(encrypted, this._key!);
    return JSON.parse(plaintext) as T;
  }

  /**
   * localStorage에서 항목을 제거합니다. (복호화 없이 수행)
   */
  removeItem(key: string): void {
    this._requireUnlocked();
    this._removeFromStorage(this._prefixedKey(key));
  }

  /**
   * 이 SecureStorage 인스턴스가 관리하는 모든 암호화 항목을 제거합니다.
   * Salt는 유지됩니다.
   */
  clearAll(): void {
    this._requireUnlocked();
    const prefix = this._prefixedKey("");
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) keysToRemove.push(k);
    }

    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }

  /**
   * 암호화된 키 목록을 반환합니다 (평문 키 이름).
   */
  keys(): string[] {
    const prefix = this._prefixedKey("");
    const result: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) {
        result.push(k.slice(prefix.length));
      }
    }

    return result;
  }

  // ── 패스워드 변경 ────────────────────────────────────────────────────

  /**
   * 마스터 패스워드를 변경합니다.
   *
   * 모든 암호화 항목을 현재 키로 복호화한 후 새 키로 재암호화합니다.
   * 완료 후 새 패스워드로 자동 잠금 해제됩니다.
   *
   * @param currentPassword - 현재 마스터 패스워드
   * @param newPassword     - 새 마스터 패스워드
   * @throws {Error} currentPassword가 틀린 경우
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    this._requireUnlocked();
    const oldKey = this._key!;

    // 모든 항목을 현재 키로 복호화
    const allKeys = this.keys();
    const plaintexts = await Promise.all(
      allKeys.map(async (k) => {
        const encrypted = this._getFromStorage(this._prefixedKey(k))!;
        const plain = await decryptWithKey(encrypted, oldKey);
        return { key: k, value: plain };
      })
    );

    // 새 Salt 생성 및 새 키 도출 — unlock()에 사용한 iterations와 동일하게 유지
    const newSalt = randomBytes(SALT_LENGTH);
    const { key: newKey } = await deriveKeyFromPassword(
      newPassword,
      newSalt,
      this._iterations
    );

    // Salt 업데이트
    this._saveToStorage(SALT_STORAGE_KEY, bytesToBase64(newSalt));
    this._key = newKey;

    // 모든 항목을 새 키로 재암호화
    await Promise.all(
      plaintexts.map(async ({ key, value }) => {
        const encrypted = await encryptWithKey(value, newKey);
        this._saveToStorage(this._prefixedKey(key), encrypted);
      })
    );
  }

  // ── 내부 유틸 ────────────────────────────────────────────────────────

  private _requireUnlocked(): void {
    if (!this._key) {
      throw new Error(
        "SecureStorage가 잠겨있습니다. unlock()을 먼저 호출하세요."
      );
    }
  }

  private _prefixedKey(key: string): string {
    return `${ITEM_PREFIX}${this._namespace}__${key}`;
  }

  private _saveToStorage(key: string, value: string): void {
    if (typeof localStorage === "undefined") {
      throw new Error("localStorage를 사용할 수 없는 환경입니다.");
    }
    localStorage.setItem(key, value);
  }

  private _getFromStorage(key: string): string | null {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  }

  private _removeFromStorage(key: string): void {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 앱 전역 싱글톤
// ─────────────────────────────────────────────────────────────────────

/**
 * 투자 관리 앱 전용 SecureStorage 싱글톤.
 * 컴포넌트에서 import하여 사용하세요.
 *
 * @example
 * import { investStorage } from "@/lib/crypto";
 * await investStorage.unlock(userPassword);
 * await investStorage.setItem("portfolio_cache", portfolioData);
 */
export const investStorage = new SecureStorage("invest-manager-v1");
