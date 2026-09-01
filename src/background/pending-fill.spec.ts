import { beforeEach, describe, expect, it } from "vitest";

import { createMemoryStorage, type VaultStorage } from "@/core/state/storage.port";

import {
  PENDING_FILL_TTL_MS,
  clearPendingFill,
  getPendingFill,
  isPendingFillValid,
  setPendingFill,
  type PendingFill,
} from "./pending-fill";

const NOW = 1_700_000_000_000;

function intent(url: string, createdAt = NOW): PendingFill {
  return { tabId: 7, url, createdAt };
}

describe("isPendingFillValid", () => {
  it("同源且未超时时有效", () => {
    expect(isPendingFillValid(intent("https://github.com/login"), "https://github.com/login", NOW)).toBe(
      true,
    );
  });

  it("同源下路径变化不影响有效性", () => {
    // 登录流程内部跳转（/login → /session）很常见，不该因此作废。
    expect(
      isPendingFillValid(intent("https://github.com/login"), "https://github.com/session", NOW),
    ).toBe(true);
  });

  it("标签页已跳转到别的站点时失效", () => {
    // 这是本模块存在的理由：解锁期间页面换了站，照旧意图填就是把
    // GitHub 的凭据送进攻击者的页面。
    expect(
      isPendingFillValid(intent("https://github.com/login"), "https://evil.example.com", NOW),
    ).toBe(false);
  });

  it("同域但协议或端口不同时失效（按 origin 而非域名比对）", () => {
    expect(isPendingFillValid(intent("https://github.com"), "http://github.com", NOW)).toBe(false);
    expect(isPendingFillValid(intent("https://github.com"), "https://github.com:8443", NOW)).toBe(
      false,
    );
  });

  it("子域不算同源", () => {
    expect(
      isPendingFillValid(intent("https://github.com"), "https://gist.github.com", NOW),
    ).toBe(false);
  });

  it("超过有效期后失效", () => {
    const stale = intent("https://github.com", NOW - PENDING_FILL_TTL_MS - 1);
    expect(isPendingFillValid(stale, "https://github.com", NOW)).toBe(false);
  });

  it("恰好在有效期边界内仍有效", () => {
    const edge = intent("https://github.com", NOW - PENDING_FILL_TTL_MS);
    expect(isPendingFillValid(edge, "https://github.com", NOW)).toBe(true);
  });

  it("系统时钟回拨时失效", () => {
    const future = intent("https://github.com", NOW + 1000);
    expect(isPendingFillValid(future, "https://github.com", NOW)).toBe(false);
  });

  it("当前地址缺失或非 http(s) 时失效", () => {
    expect(isPendingFillValid(intent("https://github.com"), undefined, NOW)).toBe(false);
    expect(isPendingFillValid(intent("https://github.com"), "chrome://extensions", NOW)).toBe(false);
    expect(isPendingFillValid(intent("https://github.com"), "about:blank", NOW)).toBe(false);
  });

  it("记录的地址非法时失效", () => {
    expect(isPendingFillValid(intent("not a url"), "https://github.com", NOW)).toBe(false);
  });
});

describe("待填充意图的存取", () => {
  let storage: VaultStorage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("写入后可读回，清除后为空", async () => {
    const value = intent("https://github.com/login");

    await setPendingFill(storage, value);
    expect(await getPendingFill(storage)).toEqual(value);

    await clearPendingFill(storage);
    expect(await getPendingFill(storage)).toBeUndefined();
  });

  it("没有意图时读回 undefined", async () => {
    expect(await getPendingFill(storage)).toBeUndefined();
  });
});
