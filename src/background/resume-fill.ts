import type { VaultStorage } from "@/core/state/storage.port";
import { getCipher } from "@/core/vault/vault-repository";
import { getLastUsedLogin } from "@/core/vault/vault.service";
import { api } from "@/platform/browser-api";
import { logger } from "@/platform/logger";

import { fillTab } from "./autofill-fill";
import { findMatchingLoginCiphers } from "./context-menu";
import { clearPendingFill, getPendingFill, isPendingFillValid } from "./pending-fill";
import { pickShortcutTarget } from "./shortcut";

/**
 * 解锁成功后，接着完成被锁定打断的那次填充。
 *
 * 选条目的规则与快捷键完全一致（pickShortcutTarget）：上次使用且匹配当前站点的
 * 条目优先，否则取匹配列表第一条。不另起一套逻辑——两套排序迟早会漂移，
 * 而漂移的后果是填错账号。
 */
export async function consumePendingFill(storage: VaultStorage): Promise<void> {
  try {
    const intent = await getPendingFill(storage);
    if (intent == null) {
      return;
    }

    // 单次使用：先清除再执行。中途失败也不能把意图留在会话里等下一次解锁。
    await clearPendingFill(storage);

    const tab = await getTab(intent.tabId);
    if (tab == null) {
      return;
    }

    const url = tab.url;
    if (url == null || !isPendingFillValid(intent, url, Date.now())) {
      logger.info("待填充意图已失效（页面已跳转或超时），跳过填充");
      return;
    }

    const lastUsedId = await getLastUsedLogin(storage);
    const lastUsed =
      lastUsedId == null ? undefined : await getCipher(storage, lastUsedId);
    // 匹配用标签页**此刻**的地址，不用意图里记录的——同源校验已确保两者同站，
    // 但路径可能变了，按当前地址匹配才准。
    const matches = await findMatchingLoginCiphers(storage, url);
    const target = pickShortcutTarget(url, lastUsed, matches);

    if (target == null) {
      return;
    }

    const result = await fillTab(storage, target.id, tab);
    if (!result.ok) {
      logger.warn("解锁后续填充失败:", result.message);
    }
  } catch (e) {
    // 由解锁处理器 void 调用，异常不能冒泡打断解锁流程。
    logger.warn("处理待填充意图失败:", e);
  }
}

/** 标签页可能已被关闭，tabs.get 会抛——那只是意图过期，不是错误。 */
async function getTab(tabId: number): Promise<chrome.tabs.Tab | undefined> {
  try {
    return await api().tabs.get(tabId);
  } catch {
    return undefined;
  }
}
