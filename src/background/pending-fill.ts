import { StorageKeys } from "@/core/state/storage-keys";
import type { VaultStorage } from "@/core/state/storage.port";

/**
 * 「解锁后继续填充」的待办意图。
 *
 * 用户在锁定态触发填充（快捷键、右键菜单）时，把「想往哪个标签页填」记下来，
 * 解锁成功后由背景页接着完成——否则用户解锁完还得再触发一次，等于白按。
 *
 * 本模块只管**存取与校验**，不含填充逻辑（那在 resume-fill.ts）。
 * 拆开是为了依赖方向：context-menu.ts 需要写入意图，而消费意图又要用到
 * context-menu.ts 的匹配函数——合在一个文件里就成了循环依赖。
 */

export interface PendingFill {
  /** 目标标签页。填充必须显式指向它，不能事后查"当前活动标签页"——回退窗口会抢焦点。 */
  tabId: number;
  /** 记录意图时该标签页的地址，用于解锁后核对页面有没有换过站点。 */
  url: string;
  createdAt: number;
}

/**
 * 意图有效期。
 *
 * 解锁要跑一遍 KDF，再加上用户找密码、输入的时间，两分钟是宽松但有界的窗口。
 * 不设上限的意图等于一颗留在会话里的定时雷。
 */
export const PENDING_FILL_TTL_MS = 2 * 60 * 1000;

export async function setPendingFill(
  storage: VaultStorage,
  intent: PendingFill,
): Promise<void> {
  await storage.session.set(StorageKeys.SessionPendingFill, intent);
}

export async function getPendingFill(
  storage: VaultStorage,
): Promise<PendingFill | undefined> {
  return await storage.session.get<PendingFill>(StorageKeys.SessionPendingFill);
}

export async function clearPendingFill(storage: VaultStorage): Promise<void> {
  await storage.session.remove(StorageKeys.SessionPendingFill);
}

/**
 * 意图是否仍可安全执行。
 *
 * 核心是**同源校验**：从按下快捷键到解锁完成之间，那个标签页完全可能已经导航到
 * 别的站点。照着旧意图闷头填，就是把 A 站的凭据送进 B 站——正是钓鱼页面想要的
 * 结果，也正是 shortcut.ts 里那条"必须匹配当前站点"规则要防的事。
 *
 * @param currentUrl 标签页**此刻**的地址，不是记录意图时的地址。
 */
export function isPendingFillValid(
  intent: PendingFill,
  currentUrl: string | undefined,
  now: number,
): boolean {
  if (currentUrl == null || !/^https?:/i.test(currentUrl)) {
    return false;
  }

  const elapsed = now - intent.createdAt;
  // 负值意味着系统时钟往回跳了，判为失效——宁可让用户重按一次。
  if (elapsed < 0 || elapsed > PENDING_FILL_TTL_MS) {
    return false;
  }

  return sameOrigin(intent.url, currentUrl);
}

function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}
