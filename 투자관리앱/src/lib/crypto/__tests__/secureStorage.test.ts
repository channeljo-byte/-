/**
 * SecureStorage 테스트
 *
 * localStorage를 Jest 메모리 Mock으로 대체합니다.
 */
import { SecureStorage } from "../secureStorage";

const TEST_PASSWORD = "test-master-password";
const TEST_ITERATIONS = 1_000; // 테스트 속도 최적화

// ── localStorage Mock ────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// ────────────────────────────────────────────────────────────────────

describe("SecureStorage", () => {
  let storage: SecureStorage;

  beforeEach(() => {
    localStorageMock.clear();
    storage = new SecureStorage("test-namespace");
  });

  // ── 잠금 해제 / 잠금 ──────────────────────────────────────────────
  describe("unlock() / lock()", () => {
    it("잠금 해제 후 상태가 unlocked여야 한다", async () => {
      expect(storage.status).toBe("locked");
      await storage.unlock(TEST_PASSWORD, { iterations: TEST_ITERATIONS });
      expect(storage.status).toBe("unlocked");
      expect(storage.isUnlocked).toBe(true);
    });

    it("lock() 호출 후 상태가 locked여야 한다", async () => {
      await storage.unlock(TEST_PASSWORD, { iterations: TEST_ITERATIONS });
      storage.lock();
      expect(storage.status).toBe("locked");
      expect(storage.isUnlocked).toBe(false);
    });

    it("Salt가 localStorage에 저장된다 (키 자체는 저장되지 않음)", async () => {
      await storage.unlock(TEST_PASSWORD, { iterations: TEST_ITERATIONS });
      const saltKey = "__secure_storage_salt__";
      expect(localStorageMock.getItem(saltKey)).not.toBeNull();
      // Salt는 민감하지 않지만, CryptoKey 자체는 절대 저장되지 않아야 함
      // (CryptoKey는 직렬화 불가 + extractable:false)
      // localStorage를 순회하여 salt와 암호화 데이터 외의 항목이 없는지 확인
      const unexpectedKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        if (!k.startsWith("__enc__") && k !== saltKey) {
          unexpectedKeys.push(k);
        }
      }
      expect(unexpectedKeys).toHaveLength(0);
    });
  });

  // ── setItem / getItem ─────────────────────────────────────────────
  describe("setItem() / getItem()", () => {
    beforeEach(async () => {
      await storage.unlock(TEST_PASSWORD, { iterations: TEST_ITERATIONS });
    });

    it("문자열 저장 및 복호화", async () => {
      await storage.setItem("username", "김투자");
      const result = await storage.getItem<string>("username");
      expect(result).toBe("김투자");
    });

    it("숫자 저장 및 복호화", async () => {
      await storage.setItem("balance", 10_000_000);
      const result = await storage.getItem<number>("balance");
      expect(result).toBe(10_000_000);
    });

    it("객체 저장 및 복호화", async () => {
      const portfolio = {
        stocks: [{ ticker: "AAPL", qty: 10 }],
        crypto: [{ coin: "BTC", qty: 0.5 }],
        totalKRW: 5_000_000,
      };
      await storage.setItem("portfolio", portfolio);
      const result = await storage.getItem<typeof portfolio>("portfolio");
      expect(result).toEqual(portfolio);
    });

    it("배열 저장 및 복호화", async () => {
      const tickers = ["AAPL", "GOOG", "005930", "BTC"];
      await storage.setItem("watchlist", tickers);
      const result = await storage.getItem<string[]>("watchlist");
      expect(result).toEqual(tickers);
    });

    it("null 저장 및 복호화", async () => {
      await storage.setItem("nothing", null);
      const result = await storage.getItem<null>("nothing");
      expect(result).toBeNull();
    });

    it("존재하지 않는 키는 null을 반환한다", async () => {
      const result = await storage.getItem("nonexistent");
      expect(result).toBeNull();
    });

    it("localStorage에 평문이 저장되지 않는다 (암호문만 존재)", async () => {
      const sensitiveData = "비밀 계좌 잔고: 1억원";
      await storage.setItem("secret", sensitiveData);

      // localStorage의 모든 값을 확인 — 평문이 없어야 함
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        const value = localStorage.getItem(key)!;
        expect(value).not.toContain(sensitiveData);
        expect(value).not.toContain("비밀");
        expect(value).not.toContain("1억원");
      }
    });

    it("동일한 데이터를 저장해도 localStorage 값이 매번 달라진다 (IV 랜덤성)", async () => {
      const data = "same data";
      await storage.setItem("item1", data);
      const raw1 = localStorage.getItem("__enc__test-namespace__item1");

      await storage.setItem("item1", data);
      const raw2 = localStorage.getItem("__enc__test-namespace__item1");

      // 같은 데이터지만 IV가 다르므로 암호문이 다름
      expect(raw1).not.toBe(raw2);
    });
  });

  // ── 잠금 상태에서 접근 차단 ──────────────────────────────────────
  describe("잠금 상태 보호", () => {
    it("잠금 상태에서 setItem()은 오류를 발생시킨다", async () => {
      // 잠금 상태 (unlock 호출 안 함)
      await expect(storage.setItem("key", "value")).rejects.toThrow(
        /잠겨있습니다/
      );
    });

    it("잠금 상태에서 getItem()은 오류를 발생시킨다", async () => {
      await expect(storage.getItem("key")).rejects.toThrow(/잠겨있습니다/);
    });

    it("lock() 후 setItem()은 오류를 발생시킨다", async () => {
      await storage.unlock(TEST_PASSWORD, { iterations: TEST_ITERATIONS });
      storage.lock();
      await expect(storage.setItem("key", "value")).rejects.toThrow(
        /잠겨있습니다/
      );
    });
  });

  // ── removeItem / clearAll ─────────────────────────────────────────
  describe("removeItem() / clearAll()", () => {
    beforeEach(async () => {
      await storage.unlock(TEST_PASSWORD, { iterations: TEST_ITERATIONS });
    });

    it("removeItem()으로 특정 항목을 삭제한다", async () => {
      await storage.setItem("to-delete", "will be gone");
      await storage.setItem("to-keep", "stays");

      storage.removeItem("to-delete");

      expect(await storage.getItem("to-delete")).toBeNull();
      expect(await storage.getItem("to-keep")).toBe("stays");
    });

    it("clearAll()로 관리 항목을 모두 삭제한다", async () => {
      await storage.setItem("item1", "a");
      await storage.setItem("item2", "b");
      await storage.setItem("item3", "c");

      storage.clearAll();

      expect(await storage.getItem("item1")).toBeNull();
      expect(await storage.getItem("item2")).toBeNull();
      expect(await storage.getItem("item3")).toBeNull();
    });
  });

  // ── keys() ───────────────────────────────────────────────────────
  describe("keys()", () => {
    beforeEach(async () => {
      await storage.unlock(TEST_PASSWORD, { iterations: TEST_ITERATIONS });
    });

    it("저장된 키 목록을 반환한다", async () => {
      await storage.setItem("alpha", 1);
      await storage.setItem("beta", 2);
      await storage.setItem("gamma", 3);

      const keys = storage.keys();
      expect(keys).toContain("alpha");
      expect(keys).toContain("beta");
      expect(keys).toContain("gamma");
      expect(keys).toHaveLength(3);
    });
  });

  // ── 세션 키 지속성 ────────────────────────────────────────────────
  describe("세션 간 데이터 지속성", () => {
    it("다른 SecureStorage 인스턴스로 잠금 해제해도 동일한 데이터를 읽을 수 있다", async () => {
      // 세션 1: 데이터 저장
      const session1 = new SecureStorage("test-namespace");
      await session1.unlock(TEST_PASSWORD, { iterations: TEST_ITERATIONS });
      await session1.setItem("persistent-data", { value: 42 });
      session1.lock();

      // 세션 2: 동일한 네임스페이스 + 패스워드로 복호화
      const session2 = new SecureStorage("test-namespace");
      await session2.unlock(TEST_PASSWORD, { iterations: TEST_ITERATIONS });
      const result = await session2.getItem<{ value: number }>("persistent-data");
      expect(result?.value).toBe(42);
    });
  });

  // ── 네임스페이스 격리 ─────────────────────────────────────────────
  describe("네임스페이스 격리", () => {
    it("다른 네임스페이스의 데이터는 서로 접근할 수 없다", async () => {
      const storageA = new SecureStorage("namespace-A");
      const storageB = new SecureStorage("namespace-B");

      await storageA.unlock(TEST_PASSWORD, { iterations: TEST_ITERATIONS });
      await storageB.unlock(TEST_PASSWORD, { iterations: TEST_ITERATIONS });

      await storageA.setItem("shared-key", "data-from-A");
      await storageB.setItem("shared-key", "data-from-B");

      // 각자 자신의 데이터만 읽음
      expect(await storageA.getItem("shared-key")).toBe("data-from-A");
      expect(await storageB.getItem("shared-key")).toBe("data-from-B");
    });
  });

  // ── changePassword ───────────────────────────────────────────────
  describe("changePassword()", () => {
    it("패스워드 변경 후 새 패스워드로 복호화할 수 있다", async () => {
      const newPassword = "new-secure-password-2024";

      await storage.unlock(TEST_PASSWORD, { iterations: TEST_ITERATIONS });
      await storage.setItem("secret", "이 데이터가 마이그레이션되어야 합니다");

      await storage.changePassword(TEST_PASSWORD, newPassword);

      // 새 패스워드로 읽기 (현재 세션에서 자동 업데이트됨)
      const result = await storage.getItem<string>("secret");
      expect(result).toBe("이 데이터가 마이그레이션되어야 합니다");
    });

    it("패스워드 변경 후 새 인스턴스도 새 패스워드로 복호화 가능하다", async () => {
      const newPassword = "renewed-password";

      await storage.unlock(TEST_PASSWORD, { iterations: TEST_ITERATIONS });
      await storage.setItem("migrated", { amount: 999 });
      await storage.changePassword(TEST_PASSWORD, newPassword);

      // 새 인스턴스로 새 패스워드 사용
      const freshStorage = new SecureStorage("test-namespace");
      await freshStorage.unlock(newPassword, { iterations: TEST_ITERATIONS });
      const result = await freshStorage.getItem<{ amount: number }>("migrated");
      expect(result?.amount).toBe(999);
    });
  });

  // ── reset ─────────────────────────────────────────────────────────
  describe("reset()", () => {
    it("reset() 후 Salt가 삭제된다", async () => {
      await storage.unlock(TEST_PASSWORD, { iterations: TEST_ITERATIONS });
      storage.reset();
      expect(localStorage.getItem("__secure_storage_salt__")).toBeNull();
      expect(storage.status).toBe("locked");
    });
  });
});
