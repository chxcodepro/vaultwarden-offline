import { beforeEach, describe, expect, it } from "vitest";

import { KdfType, type KdfConfig } from "@/core/crypto";
import { StorageKeys } from "@/core/state/storage-keys";
import { VaultTimeoutType } from "@/core/state/settings";
import { createMemoryStorage } from "@/core/state/storage.port";
import type { VaultStorage } from "@/core/state/storage.port";
import { VaultStatus } from "@/core/state/vault-status";

import {
  InvalidMasterPasswordError,
  InvalidPinError,
  ThrottledError,
  validateMasterPassword,
  validatePin,
  changeMasterPassword,
  clearPin,
  clearVault,
  clearVaultData,
  hasPin,
  setPin,
  unlockWithPin,
  createVault,
  getLastActivity,
  getLastUsedLogin,
  getMeta,
  getSessionUserKey,
  getSettings,
  getStatus,
  getThrottleState,
  lock,
  readVaultData,
  requireUserKey,
  saveSettings,
  setLastUsedLogin,
  touchActivity,
  unlock,
  writeVaultData,
} from "./vault.service";

/** 测试用低强度 KDF：验证的是状态流转，不是派生成本。 */
const FAST_KDF: KdfConfig = { type: KdfType.PBKDF2_SHA256, iterations: 5_000 };

let storage: VaultStorage;

beforeEach(() => {
  storage = createMemoryStorage();
});

describe("主密码策略", () => {
  it("至少 8 位且含字母和数字才合法", () => {
    expect(validateMasterPassword("abcdefgh")).toBe("需同时包含字母和数字");
    expect(validateMasterPassword("12345678")).toBe("需同时包含字母和数字");
    expect(validateMasterPassword("abc123")).toBe("至少 8 位，当前 6 位");
    expect(validateMasterPassword("")).toBe("主密码不能为空");
    expect(validateMasterPassword("abc12345")).toBeNull();
    expect(validateMasterPassword("密码abc123")).toBeNull();
  });

  it("创建密码库拒绝不合规主密码", async () => {
    await expect(createVault(storage, "password", { kdf: FAST_KDF })).rejects.toThrow(
      /同时包含字母和数字/,
    );
    await expect(createVault(storage, "12345678", { kdf: FAST_KDF })).rejects.toThrow(
      /同时包含字母和数字/,
    );
    await expect(createVault(storage, "short1", { kdf: FAST_KDF })).rejects.toThrow(/至少 8 位/);
  });

  it("修改主密码同样要求合规", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });

    await expect(changeMasterPassword(storage, "master-pass1", "weakpass")).rejects.toThrow(
      /同时包含字母和数字/,
    );
  });
});

describe("状态机", () => {
  it("初始为未初始化", async () => {
    expect(await getStatus(storage)).toBe(VaultStatus.Uninitialized);
  });

  it("创建后处于已解锁", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });

    expect(await getStatus(storage)).toBe(VaultStatus.Unlocked);
    expect(await getSessionUserKey(storage)).toBeDefined();
  });

  it("锁定后密文仍在，仅丢弃运行期密钥", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    const metaBefore = await getMeta(storage);

    await lock(storage);

    expect(await getStatus(storage)).toBe(VaultStatus.Locked);
    expect(await getSessionUserKey(storage)).toBeUndefined();
    expect(await getMeta(storage)).toEqual(metaBefore);
  });

  it("销毁后回到未初始化且数据不可恢复", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });

    await clearVault(storage);

    expect(await getStatus(storage)).toBe(VaultStatus.Uninitialized);
    expect(await getMeta(storage)).toBeUndefined();
    expect(await storage.local.get(StorageKeys.VaultData)).toBeUndefined();
  });

  it("拒绝在已有密码库时重复创建", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });

    await expect(createVault(storage, "another1", { kdf: FAST_KDF })).rejects.toThrow(/已存在/);
  });

  it("拒绝空主密码", async () => {
    await expect(createVault(storage, "", { kdf: FAST_KDF })).rejects.toThrow(/不能为空/);
  });
});

describe("解锁", () => {
  beforeEach(async () => {
    await createVault(storage, "correct-pass1", { kdf: FAST_KDF });
    await lock(storage);
  });

  it("正确密码可解锁", async () => {
    await unlock(storage, "correct-pass1");

    expect(await getStatus(storage)).toBe(VaultStatus.Unlocked);
  });

  it("解锁得到的 UserKey 与创建时一致", async () => {
    // 若两者不同，之前加密的数据就再也解不开了。
    const first = await getSessionUserKey(storage);
    expect(first).toBeUndefined();

    const unlocked = await unlock(storage, "correct-pass1");
    const fromSession = await getSessionUserKey(storage);

    expect(fromSession?.toBase64()).toBe(unlocked.toBase64());
  });

  it("错误密码被拒绝且不改变状态", async () => {
    await expect(unlock(storage, "wrong-password")).rejects.toThrow(InvalidMasterPasswordError);

    expect(await getStatus(storage)).toBe(VaultStatus.Locked);
  });

  it("未初始化时解锁报错", async () => {
    await clearVault(storage);

    await expect(unlock(storage, "whatever")).rejects.toThrow(/没有密码库/);
  });
});

describe("解锁节流", () => {
  beforeEach(async () => {
    await createVault(storage, "correct-pass1", { kdf: FAST_KDF });
    await lock(storage);
  });

  it("前两次失败不惩罚", async () => {
    const now = 1_000_000;

    await expect(unlock(storage, "wrong", now)).rejects.toThrow(InvalidMasterPasswordError);
    await expect(unlock(storage, "wrong", now)).rejects.toThrow(InvalidMasterPasswordError);
  });

  it("第三次失败后开始强制等待", async () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      await expect(unlock(storage, "wrong", now)).rejects.toThrow(InvalidMasterPasswordError);
    }

    // 即便密码正确，也必须先等冷却结束。
    await expect(unlock(storage, "correct-pass1", now + 1)).rejects.toThrow(ThrottledError);
  });

  it("等待期过后可正常解锁", async () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      await expect(unlock(storage, "wrong", now)).rejects.toThrow(InvalidMasterPasswordError);
    }

    await unlock(storage, "correct-pass1", now + 60_000);

    expect(await getStatus(storage)).toBe(VaultStatus.Unlocked);
  });

  it("等待时间随失败次数指数增长", async () => {
    let now = 1_000_000;
    const failOnce = async () =>
      await expect(unlock(storage, "wrong", now)).rejects.toThrow(InvalidMasterPasswordError);

    // 前两次是免罚额度。
    await failOnce();
    await failOnce();

    const delays: number[] = [];
    for (let i = 0; i < 3; i++) {
      await failOnce();
      const { lockedUntil } = await getThrottleState(storage);
      const delay = (lockedUntil as number) - now;
      delays.push(delay);
      // 推进到冷却刚结束，以便下一次尝试能真正抵达密码校验。
      now += delay;
    }

    // 5s → 10s → 20s，这条序列就是节流策略本身，改动策略应同步改这里。
    expect(delays).toEqual([5_000, 10_000, 20_000]);
  });

  it("成功解锁后清零计数", async () => {
    const now = 1_000_000;
    await expect(unlock(storage, "wrong", now)).rejects.toThrow(InvalidMasterPasswordError);

    await unlock(storage, "correct-pass1", now);
    await lock(storage);

    // 计数已清零，因此又能连续错两次而不被节流。
    await expect(unlock(storage, "wrong", now)).rejects.toThrow(InvalidMasterPasswordError);
    await expect(unlock(storage, "wrong", now)).rejects.toThrow(InvalidMasterPasswordError);
  });

  it("节流状态存在 local，重启浏览器（清空 session）也绕不过", async () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      await expect(unlock(storage, "wrong", now)).rejects.toThrow(InvalidMasterPasswordError);
    }

    // 模拟浏览器重启：session 全清。
    await storage.session.remove([StorageKeys.SessionUserKey, StorageKeys.SessionLastActivity]);

    await expect(unlock(storage, "correct-pass1", now + 1)).rejects.toThrow(ThrottledError);
  });
});

describe("修改主密码", () => {
  it("换密码后 UserKey 不变，已有数据仍可解密", async () => {
    await createVault(storage, "old-pass1", { kdf: FAST_KDF });
    const originalKey = (await getSessionUserKey(storage))?.toBase64();

    await changeMasterPassword(storage, "old-pass1", "new-pass1");
    await lock(storage);
    await unlock(storage, "new-pass1");

    // 这是整个密钥层级设计的意义：改密码只重新包裹 UserKey，不动数据。
    expect((await getSessionUserKey(storage))?.toBase64()).toBe(originalKey);
  });

  it("旧密码随即失效", async () => {
    await createVault(storage, "old-pass1", { kdf: FAST_KDF });

    await changeMasterPassword(storage, "old-pass1", "new-pass1");
    await lock(storage);

    await expect(unlock(storage, "old-pass1")).rejects.toThrow(InvalidMasterPasswordError);
  });

  it("当前密码不对则拒绝修改", async () => {
    await createVault(storage, "old-pass1", { kdf: FAST_KDF });
    await lock(storage);

    await expect(changeMasterPassword(storage, "wrong", "new-pass1")).rejects.toThrow(
      InvalidMasterPasswordError,
    );
  });

  it("换密码会同时更换 salt", async () => {
    await createVault(storage, "old-pass1", { kdf: FAST_KDF });
    const saltBefore = (await getMeta(storage))?.salt;

    await changeMasterPassword(storage, "old-pass1", "new-pass1");

    expect((await getMeta(storage))?.salt).not.toBe(saltBefore);
  });
});

describe("会话与活动时间", () => {
  it("创建即记录活动时间", async () => {
    await createVault(storage, "pw1234abcd", { kdf: FAST_KDF });

    expect(await getLastActivity(storage)).toBeTypeOf("number");
  });

  it("touch 刷新活动时间", async () => {
    await createVault(storage, "pw1234abcd", { kdf: FAST_KDF });

    await touchActivity(storage, 5_000_000);

    expect(await getLastActivity(storage)).toBe(5_000_000);
  });

  it("锁定态下 touch 不产生任何会话数据", async () => {
    await createVault(storage, "pw1234abcd", { kdf: FAST_KDF });
    await lock(storage);

    await touchActivity(storage, 5_000_000);

    expect(await getLastActivity(storage)).toBeUndefined();
  });

  it("requireUserKey 在锁定态抛错", async () => {
    await createVault(storage, "pw1234abcd", { kdf: FAST_KDF });
    await lock(storage);

    await expect(requireUserKey(storage)).rejects.toThrow(/锁定状态/);
  });
});

describe("跨浏览器重启保持解锁", () => {
  function restartBrowser(): VaultStorage {
    return { local: storage.local, session: createMemoryStorage().session };
  }

  it.each([15, VaultTimeoutType.Immediately, VaultTimeoutType.OnIdle, VaultTimeoutType.OnRestart])(
    "%s 模式重启后仍锁定，且不保存明文密钥",
    async (vaultTimeout) => {
      await saveSettings(storage, { vaultTimeout });
      await createVault(storage, "master-pass1", { kdf: FAST_KDF });

      expect(await storage.local.get(StorageKeys.RememberedUserKey)).toBeUndefined();
      expect(await getStatus(restartBrowser())).toBe(VaultStatus.Locked);
    },
  );

  it("已解锁时切到永不，重启后使用同一把 UserKey 且不恢复填充意图", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    const originalKey = (await requireUserKey(storage)).toBase64();
    await storage.session.set(StorageKeys.SessionPendingFill, { tabId: 42 });
    await saveSettings(storage, { vaultTimeout: VaultTimeoutType.Never });

    storage = restartBrowser();

    expect(await getStatus(storage)).toBe(VaultStatus.Unlocked);
    expect((await requireUserKey(storage)).toBase64()).toBe(originalKey);
    expect(await storage.session.get(StorageKeys.SessionPendingFill)).toBeUndefined();
  });

  it("永不模式创建密码库时保存密钥", async () => {
    await saveSettings(storage, { vaultTimeout: VaultTimeoutType.Never });
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });

    expect(await getStatus(restartBrowser())).toBe(VaultStatus.Unlocked);
  });

  it("手动锁定删除保存的密钥，重启不会自动解锁", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    await saveSettings(storage, { vaultTimeout: VaultTimeoutType.Never });
    storage = restartBrowser();
    await lock(storage);

    expect(await storage.local.get(StorageKeys.RememberedUserKey)).toBeUndefined();
    expect(await getStatus(storage)).toBe(VaultStatus.Locked);
    expect(await getStatus(restartBrowser())).toBe(VaultStatus.Locked);
    await expect(requireUserKey(storage)).rejects.toThrow(/锁定状态/);
  });

  it("主密码重新解锁后再次保留跨重启访问", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    await saveSettings(storage, { vaultTimeout: VaultTimeoutType.Never });
    await lock(storage);
    await unlock(storage, "master-pass1");

    expect(await getStatus(restartBrowser())).toBe(VaultStatus.Unlocked);
  });

  it("PIN 重新解锁后也保留跨重启访问", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    await setPin(storage, "2468");
    await saveSettings(storage, { vaultTimeout: VaultTimeoutType.Never });
    await lock(storage);
    const userKey = await unlockWithPin(storage, "2468");

    expect((await requireUserKey(restartBrowser())).toBase64()).toBe(userKey.toBase64());
  });

  it("重启后关闭永不，当前会话保持解锁但下次重启锁定", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    await saveSettings(storage, { vaultTimeout: VaultTimeoutType.Never });
    storage = restartBrowser();
    await saveSettings(storage, { vaultTimeout: 15 });

    expect(await getStatus(storage)).toBe(VaultStatus.Unlocked);
    expect(await getLastActivity(storage)).toBeTypeOf("number");
    expect(await storage.local.get(StorageKeys.RememberedUserKey)).toBeUndefined();
    expect(await getStatus(restartBrowser())).toBe(VaultStatus.Locked);
  });

  it("重启后更新无关设置不会丢失跨重启访问", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    await saveSettings(storage, { vaultTimeout: VaultTimeoutType.Never });
    storage = restartBrowser();
    await saveSettings(storage, { vaultTimeoutAction: "clear" });

    expect(await getStatus(restartBrowser())).toBe(VaultStatus.Unlocked);
  });

  it("锁定时改设置不能绕过密码解锁", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    await lock(storage);
    await saveSettings(storage, { vaultTimeout: VaultTimeoutType.Never });

    expect(await getStatus(storage)).toBe(VaultStatus.Locked);
    expect(await storage.local.get(StorageKeys.RememberedUserKey)).toBeUndefined();
  });

  it("修改主密码同步更新保存的密钥绑定，手动锁定后旧密码仍失效", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    await saveSettings(storage, { vaultTimeout: VaultTimeoutType.Never });
    const originalKey = (await requireUserKey(storage)).toBase64();
    await changeMasterPassword(storage, "master-pass1", "new-pass1");
    storage = restartBrowser();

    expect((await requireUserKey(storage)).toBase64()).toBe(originalKey);
    await lock(storage);
    await expect(unlock(storage, "master-pass1")).rejects.toThrow(InvalidMasterPasswordError);
    await unlock(storage, "new-pass1");
    expect(await getStatus(restartBrowser())).toBe(VaultStatus.Unlocked);
  });

  it("销毁并重建密码库不能复用旧密钥", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    await saveSettings(storage, { vaultTimeout: VaultTimeoutType.Never });
    const oldRemembered = await storage.local.get(StorageKeys.RememberedUserKey);
    await clearVault(storage);
    expect(await storage.local.get(StorageKeys.RememberedUserKey)).toBeUndefined();
    await createVault(storage, "new-pass1", { kdf: FAST_KDF });
    await storage.local.set(StorageKeys.RememberedUserKey, oldRemembered);

    expect(await getStatus(restartBrowser())).toBe(VaultStatus.Locked);
  });

  it.each(["not-base64!", "AQID", "A".repeat(44), null, 123])(
    "损坏的保存密钥 %s 不会导致自动解锁或状态查询报错",
    async (userKey) => {
      await createVault(storage, "master-pass1", { kdf: FAST_KDF });
      await saveSettings(storage, { vaultTimeout: VaultTimeoutType.Never });
      await storage.local.set(StorageKeys.RememberedUserKey, {
        userKey,
        wrappedUserKey: (await getMeta(storage))?.wrappedUserKey,
      });

      expect(await getStatus(restartBrowser())).toBe(VaultStatus.Locked);
    },
  );

  it("非永不设置忽略残留保存密钥", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    await saveSettings(storage, { vaultTimeout: VaultTimeoutType.Never });
    await storage.local.set(StorageKeys.Settings, { vaultTimeout: 15 });

    expect(await getStatus(restartBrowser())).toBe(VaultStatus.Locked);
  });
});

describe("清空数据", () => {
  it("清空条目与文件夹，保留密码库结构与主密码", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    const metaBefore = await getMeta(storage);
    await writeVaultData(storage, {
      ciphers: [
        {
          id: "c1",
          type: 1,
          name: "2.a|b|c",
          favorite: false,
          reprompt: 0,
          creationDate: "2026-01-01T00:00:00.000Z",
          revisionDate: "2026-01-01T00:00:00.000Z",
        } as never,
      ],
      folders: [],
    });

    await clearVaultData(storage);

    // 数据清空，但库本身（meta）与解锁状态保留。
    expect(await readVaultData(storage)).toEqual({ ciphers: [], folders: [] });
    expect(await getMeta(storage)).toEqual(metaBefore);
    expect(await getStatus(storage)).toBe(VaultStatus.Unlocked);
  });

  it("锁定态清空被拒绝", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    await lock(storage);

    await expect(clearVaultData(storage)).rejects.toThrow(/锁定状态/);
  });
});

describe("PIN 解锁", () => {
  it("规则校验：4-12 位数字字母", () => {
    expect(validatePin("")).toBe("PIN 不能为空");
    expect(validatePin("abc")).toBe("至少 4 位，当前 3 位");
    expect(validatePin("1234567890123")).toBe("最多 12 位");
    expect(validatePin("ab@12")).toBe("仅限数字和字母");
    expect(validatePin("abcd")).toBeNull();
    expect(validatePin("1234")).toBeNull();
    expect(validatePin("a1b2c3d4e5f6")).toBeNull();
  });

  it("设置后可查询，且解锁拿到与主密码相同的 UserKey", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    const masterKey = await getSessionUserKey(storage);

    expect(await hasPin(storage)).toBe(false);
    await setPin(storage, "2468");
    expect(await hasPin(storage)).toBe(true);

    await lock(storage);
    const pinUserKey = await unlockWithPin(storage, "2468");

    // 关键：PIN 解锁拿到的是同一把 UserKey，之前加密的数据必须能解开。
    expect(pinUserKey.toBase64()).toBe(masterKey?.toBase64());
    expect(await getStatus(storage)).toBe(VaultStatus.Unlocked);
  });

  it("错误 PIN 被拒绝并计入节流", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    await setPin(storage, "2468");
    await lock(storage);

    const now = 1_000_000;
    // 前两次是免罚额度。
    await expect(unlockWithPin(storage, "9999", now)).rejects.toThrow(InvalidPinError);
    await expect(unlockWithPin(storage, "9999", now)).rejects.toThrow(InvalidPinError);
    // 第三次失败开始上锁。
    await expect(unlockWithPin(storage, "9999", now)).rejects.toThrow(InvalidPinError);
    // 冷却期内正确 PIN 也被拒；主密码解锁共用同一套节流。
    await expect(unlockWithPin(storage, "2468", now)).rejects.toThrow(ThrottledError);
  });

  it("未设置 PIN 时解锁报错", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    await lock(storage);

    await expect(unlockWithPin(storage, "2468")).rejects.toThrow(/未设置 PIN/);
  });

  it("移除 PIN 后无法再用 PIN 解锁", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    await setPin(storage, "2468");
    await clearPin(storage);

    expect(await hasPin(storage)).toBe(false);
    await lock(storage);
    await expect(unlockWithPin(storage, "2468")).rejects.toThrow(/未设置 PIN/);
  });

  it("设置 PIN 拒绝不合规值", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });

    await expect(setPin(storage, "12")).rejects.toThrow(/至少 4 位/);
    await expect(setPin(storage, "ab@1")).rejects.toThrow(/仅限数字和字母/);
  });

  it("修改 PIN 后旧 PIN 失效、新 PIN 生效", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    await setPin(storage, "2468");
    await setPin(storage, "13579");
    await lock(storage);

    await expect(unlockWithPin(storage, "2468")).rejects.toThrow(InvalidPinError);
    expect((await unlockWithPin(storage, "13579")).key.length).toBe(64);
  });

  it("PIN 解锁成功后清空节流计数", async () => {
    await createVault(storage, "master-pass1", { kdf: FAST_KDF });
    await setPin(storage, "2468");
    await lock(storage);

    const now = 1_000_000;
    await expect(unlockWithPin(storage, "9999", now)).rejects.toThrow(InvalidPinError);
    await unlockWithPin(storage, "2468", now);
    await lock(storage);

    // 计数已清零：又能连续错两次而不被节流。
    await expect(unlockWithPin(storage, "9999", now)).rejects.toThrow(InvalidPinError);
    await expect(unlockWithPin(storage, "9999", now)).rejects.toThrow(InvalidPinError);
  });
});

describe("最近使用", () => {
  it("记录后可读回", async () => {
    await createVault(storage, "pw1234abcd", { kdf: FAST_KDF });

    expect(await getLastUsedLogin(storage)).toBeUndefined();

    await setLastUsedLogin(storage, "cipher-1");
    expect(await getLastUsedLogin(storage)).toBe("cipher-1");

    await setLastUsedLogin(storage, "cipher-2");
    expect(await getLastUsedLogin(storage)).toBe("cipher-2");
  });

  it("锁定不擦除记录——快捷键在下次解锁后仍能命中上次的条目", async () => {
    await createVault(storage, "pw1234abcd", { kdf: FAST_KDF });
    await setLastUsedLogin(storage, "cipher-1");
    await lock(storage);

    expect(await getLastUsedLogin(storage)).toBe("cipher-1");
  });

  it("销毁密码库时一并清除", async () => {
    await createVault(storage, "pw1234abcd", { kdf: FAST_KDF });
    await setLastUsedLogin(storage, "cipher-1");
    await clearVault(storage);

    expect(await getLastUsedLogin(storage)).toBeUndefined();
  });
});

describe("数据读写", () => {
  it("未写入时返回空库而非 undefined", async () => {
    expect(await readVaultData(storage)).toEqual({ ciphers: [], folders: [] });
  });

  it("写入后可读回", async () => {
    await createVault(storage, "pw1234abcd", { kdf: FAST_KDF });
    const data = { ciphers: [], folders: [] };

    await writeVaultData(storage, data);

    expect(await readVaultData(storage)).toEqual(data);
  });
});

describe("设置", () => {
  it("未设置时给出默认值", async () => {
    const settings = await getSettings(storage);

    expect(settings.vaultTimeout).toBe(15);
    expect(settings.vaultTimeoutAction).toBe("lock");
  });

  it("保存后可读回并支持部分更新", async () => {
    await saveSettings(storage, { vaultTimeout: VaultTimeoutType.Never });
    await saveSettings(storage, { vaultTimeoutAction: "clear" });

    const settings = await getSettings(storage);

    expect(settings.vaultTimeout).toBe(VaultTimeoutType.Never);
    expect(settings.vaultTimeoutAction).toBe("clear");
  });

  it("非法值回落到默认，不会把坏数据写进状态", async () => {
    await storage.local.set(StorageKeys.Settings, { vaultTimeout: -5, vaultTimeoutAction: "boom" });

    const settings = await getSettings(storage);

    expect(settings.vaultTimeout).toBe(15);
    expect(settings.vaultTimeoutAction).toBe("lock");
  });
});
