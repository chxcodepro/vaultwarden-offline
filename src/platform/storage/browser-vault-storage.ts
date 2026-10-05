import { api, storage } from "@/platform/browser-api";
import { StorageKeys } from "@/core/state/storage-keys";
import type { KeyValueStore, VaultStorage } from "@/core/state/storage.port";

/**
 * 把 `chrome.storage` 适配成领域层依赖的存储端口。
 *
 * 领域逻辑不认识 chrome，只认识这个接口——因此保险库状态机能在 Node 里
 * 用内存实现完整测试。
 */

const localStore: KeyValueStore = {
  get: (key) => storage.local.get(key),
  set: async (key, value) => {
    if (key === StorageKeys.RememberedUserKey) {
      // Chromium exposes local storage to content scripts by default. Restrict
      // access before writing a plaintext key; Firefox has no such API.
      await api().storage.local.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" });
    }
    await storage.local.set(key, value);
  },
  remove: (key) => storage.local.remove(key),
};

const sessionStore: KeyValueStore = {
  get: (key) => storage.session.get(key),
  set: (key, value) => storage.session.set(key, value),
  remove: (key) => storage.session.remove(key),
};

export const browserVaultStorage: VaultStorage = {
  local: localStore,
  session: sessionStore,
};
