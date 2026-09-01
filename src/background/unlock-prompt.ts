import { VaultStatus } from "@/core/state/vault-status";
import type { VaultStorage } from "@/core/state/storage.port";
import { api, runtime } from "@/platform/browser-api";
import { logger } from "@/platform/logger";

import { setPendingFill } from "./pending-fill";

/**
 * 打开解锁界面。
 *
 * 锁定态下的填充触发（快捷键、浮层、右键菜单）都走这里——用户按了键却毫无反应
 * 是最糟的反馈，至少要把解锁入口摆到面前。
 *
 * 优先真实 popup，回退独立小窗口：
 *   - `action.openPopup()` 自 Chrome 127 起才对普通扩展开放（118–126 仅限策略安装），
 *     而本扩展支持到 Chrome 110 / Firefox 115，因此必须能力检测 + try/catch。
 *   - 该 API 通常还要求**用户手势**。快捷键路径（commands.onCommand）处在用户触发
 *     上下文里，成功率高；浮层与右键菜单经 sendMessage 绕到 SW，用户激活多半已经丢失。
 *     所以回退不是可选项，而是那两条路径的主路径。
 *
 * popup 页面自身会按密码库状态路由到解锁/创建视图，这里不需要传任何参数。
 */

const POPUP_PATH = "popup/index.html";

/** popup 本体 380×560（src/popup/app.css），留出窗口边框。 */
const FALLBACK_WINDOW_WIDTH = 400;
const FALLBACK_WINDOW_HEIGHT = 620;

export async function openUnlockUi(): Promise<void> {
  if (await tryNativePopup()) {
    return;
  }
  await openFallbackWindow();
}

/**
 * 锁定态下有人触发了填充：记下意图，再把解锁界面摆到用户面前。
 *
 * 解锁完成后由 resume-fill.ts 接着填，用户不用重按一次。
 * 仅在 `Locked` 时记意图——密码库还没创建时是空库，没有可填的东西。
 *
 * @param tab 目标标签页。右键菜单的目标页不一定是当前活动页，因此由调用方传入。
 */
export async function promptUnlockForFill(
  storage: VaultStorage,
  status: VaultStatus,
  tab: { id?: number; url?: string } | undefined,
): Promise<void> {
  if (
    status === VaultStatus.Locked &&
    tab?.id != null &&
    tab.url != null &&
    /^https?:/i.test(tab.url)
  ) {
    await setPendingFill(storage, {
      tabId: tab.id,
      url: tab.url,
      createdAt: Date.now(),
    });
  }

  await openUnlockUi();
}

/** 返回 true 表示真实 popup 已打开，无需回退。 */
async function tryNativePopup(): Promise<boolean> {
  // 低版本浏览器上这个方法根本不存在，不能直接调用。
  const action: typeof chrome.action | undefined = api().action;
  if (action == null || typeof action.openPopup !== "function") {
    return false;
  }

  try {
    await action.openPopup();
    return true;
  } catch (e) {
    // 版本过低、缺少用户手势、无可用窗口——都归为「走回退」，不是错误。
    logger.info("action.openPopup 不可用，改用独立窗口:", e);
    return false;
  }
}

/**
 * 回退：独立小窗口。
 *
 * 先找是否已经开着一个——用户连按两次快捷键不该堆出两个窗口。
 * 用查询而非模块变量记窗口 id：MV3 的 service worker 随时被回收，
 * 模块作用域里的状态活不过一次休眠。
 */
async function openFallbackWindow(): Promise<void> {
  const url = runtime.getURL(POPUP_PATH);

  try {
    const existingId = await findExistingWindow(url);
    if (existingId != null) {
      await api().windows.update(existingId, { focused: true });
      return;
    }
  } catch (e) {
    logger.warn("查找已有解锁窗口失败，直接新建:", e);
  }

  try {
    await api().windows.create({
      url,
      type: "popup",
      width: FALLBACK_WINDOW_WIDTH,
      height: FALLBACK_WINDOW_HEIGHT,
    });
  } catch (e) {
    logger.error("打开解锁窗口失败:", e);
  }
}

async function findExistingWindow(url: string): Promise<number | undefined> {
  const windows = await api().windows.getAll({ populate: true, windowTypes: ["popup"] });

  for (const win of windows) {
    if (win.id == null) {
      continue;
    }
    // 弹窗内可能已经跳转过（例如用户在里面翻到了设置页），只比对前缀。
    if (win.tabs?.some((tab) => tab.url?.startsWith(url) === true) === true) {
      return win.id;
    }
  }

  return undefined;
}
