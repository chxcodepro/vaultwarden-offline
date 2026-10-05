import { beforeEach, describe, expect, it, vi } from "vitest";

import { StorageKeys } from "@/core/state/storage-keys";

const mocks = vi.hoisted(() => ({
  setAccessLevel: vi.fn(),
  set: vi.fn(),
}));

vi.mock("@/platform/browser-api", () => ({
  api: () => ({ storage: { local: { setAccessLevel: mocks.setAccessLevel } } }),
  storage: {
    local: { set: mocks.set, get: vi.fn(), remove: vi.fn() },
    session: { set: vi.fn(), get: vi.fn(), remove: vi.fn() },
  },
}));

import { browserVaultStorage } from "./browser-vault-storage";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("remembered key storage access", () => {
  it("restricts content-script access before persisting a plaintext key", async () => {
    await browserVaultStorage.local.set(StorageKeys.RememberedUserKey, "test-key");

    expect(mocks.setAccessLevel).toHaveBeenCalledWith({ accessLevel: "TRUSTED_CONTEXTS" });
    expect(mocks.setAccessLevel.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.set.mock.invocationCallOrder[0]!,
    );
    expect(mocks.set).toHaveBeenCalledWith(StorageKeys.RememberedUserKey, "test-key");
  });

  it("does not persist a key if access restriction fails", async () => {
    mocks.setAccessLevel.mockRejectedValueOnce(new Error("restriction failed"));

    await expect(
      browserVaultStorage.local.set(StorageKeys.RememberedUserKey, "test-key"),
    ).rejects.toThrow("restriction failed");
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("leaves ordinary storage writes unchanged", async () => {
    await browserVaultStorage.local.set(StorageKeys.Settings, { vaultTimeout: 15 });

    expect(mocks.setAccessLevel).not.toHaveBeenCalled();
    expect(mocks.set).toHaveBeenCalledOnce();
  });
});
