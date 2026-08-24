import { FaviconMode } from "@/core/state/settings";
import type { VaultStorage } from "@/core/state/storage.port";
import { extractHostname, hostWithPort } from "@/core/vault/uri-matching";
import { getSettings } from "@/core/vault/vault.service";
import { storage, tabs } from "@/platform/browser-api";
import { logger } from "@/platform/logger";

/**
 * 站点 favicon 获取与缓存。
 *
 * 取图方式由 `settings.faviconMode` 决定（默认「仅同源」）：
 *   1. 站点优先：借助当前标签页 content script 做**同源** fetch（同源无需 CORS），
 *      拿到站点真实的 favicon。你已经在访问该站点，不产生任何新的信息披露
 *   2. 回退 Google s2 favicon 服务（带 CORS，几乎 100% 可用）
 *   3. 再回退 DuckDuckGo icons（大陆可达性更好，无重定向）
 *
 * ⚠️ 第 2、3 步是本项目零网络承诺的**唯一例外**，会把密码库里保存的域名连同
 * 本机 IP 发给第三方，因此**默认关闭**，须由用户在「设置 → 网站图标」显式开启 ——
 * 商店描述声称本扩展不联网，默认替用户做主会让声明与实际行为不符。
 *
 * 整条链路失败时记录**失败冷却**（6 小时）：期间不再重试——避免反复打
 * 不可达的网络（如大陆访问 Google），静默且无害，站点加了图标后 6 小时内
 * 也会自动恢复。
 *
 * 获取时机：新增条目时、站点匹配出现时（静默获取，不阻塞任何交互）。
 * 缓存：storage.local，键 `vwo:favicons:{domain}`，随每次获取更新。
 */

export const FAVICON_CACHE_PREFIX = "vwo:favicons:";
const FAIL_PREFIX = "vwo:favicon-fail:";
/** 整条链路失败的冷却时长。 */
const FAIL_COOLDOWN_MS = 6 * 60 * 60 * 1000;

interface FaviconCacheEntry {
  dataUrl: string;
  updatedAt: number;
}

interface FaviconFailEntry {
  failedAt: number;
  /**
   * 记录失败当时第三方回退是否可用。
   *
   * 缺该字段 = 本次改动之前写下的老记录，那时第三方恒开，按 true 处理。
   */
  thirdParty?: boolean;
}

export async function getCachedFavicon(domain: string): Promise<string | undefined> {
  const entry = await storage.local.get<FaviconCacheEntry>(`${FAVICON_CACHE_PREFIX}${domain}`);
  return entry?.dataUrl;
}

/**
 * 清空全部站点图标缓存与失败冷却记录，返回清除的键数。
 *
 * 供设置页使用：用户把取图方式关掉时，通常也希望之前取回来的图标一并消失，
 * 否则「已关闭」和界面上仍在显示的真实图标是矛盾的。
 */
export async function clearFaviconCache(): Promise<number> {
  const keys = (await storage.local.keys()).filter(
    (key) => key.startsWith(FAVICON_CACHE_PREFIX) || key.startsWith(FAIL_PREFIX),
  );
  if (keys.length > 0) {
    await storage.local.remove(keys);
  }
  return keys.length;
}

/**
 * 静默获取站点 favicon 并更新缓存。
 *
 * @param vaultStorage 用于读取 `faviconMode` 设置。MV3 的 SW 随时会被回收，
 *                     所以每次都现读，不做任何缓存
 * @param url  站点地址
 * @param tabId 当前标签页（可空）：存在时优先让 content script 同源获取
 * @returns 是否成功取得
 */
export async function fetchFavicon(
  vaultStorage: VaultStorage,
  url: string,
  tabId?: number,
): Promise<boolean> {
  // 缓存与冷却键用「主机+端口」：192.168.2.4:3000 与 :8080 是不同站点，
  // 图标不应串用。favicon 服务请求参数仍用纯域名（服务端不关心端口）。
  const hostKey = hostWithPort(url);
  const domain = extractHostname(url);
  if (hostKey == null || domain == null) {
    return false;
  }

  const mode = (await getSettings(vaultStorage)).faviconMode;
  // 完全关闭：连冷却键都不写——关闭期间没必要往 storage 里堆无用的键。
  if (mode === FaviconMode.Off) {
    return false;
  }
  const allowThirdParty = mode === FaviconMode.ThirdParty;

  // 冷却期内通常不再重试（整条链路失败过）。
  const fail = await storage.local.get<FaviconFailEntry>(`${FAIL_PREFIX}${hostKey}`);
  if (fail != null && Date.now() - fail.failedAt < FAIL_COOLDOWN_MS) {
    // 唯一的例外：失败当时没有第三方回退，现在有了 —— 可用来源严格变多，
    // 值得立刻重试。否则用户刚打开开关，却还要再等最多 6 小时才看得到图标。
    if ((fail.thirdParty ?? true) || !allowThirdParty) {
      return false;
    }
  }

  let dataUrl: string | undefined;

  // 1. 站点优先：content script 同源 fetch（当前标签页就是这个站点时无需 CORS）。
  if (tabId != null) {
    try {
      const result = await tabs.sendMessage<{ dataUrl?: string }>(tabId, {
        command: "favicon:fetch",
        payload: { origin: originOf(url) },
      });
      if (result?.dataUrl != null && result.dataUrl !== "") {
        dataUrl = result.dataUrl;
      }
    } catch (e) {
      logger.debug("favicon 同源获取失败，尝试回退:", e);
    }
  }

  // 2. 回退：Google s2 服务（质量好；大陆网络常不可达）。仅在用户显式开启后执行。
  if (dataUrl == null && allowThirdParty) {
    try {
      const response = await fetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`);
      if (response.ok) {
        dataUrl = await blobToDataUrl(await response.blob());
      }
    } catch (e) {
      logger.debug("favicon Google 回退失败，尝试 DuckDuckGo:", e);
    }
  }

  // 3. 再回退：DuckDuckGo icons（大陆可达性更好，无重定向）。同样受开关约束。
  if (dataUrl == null && allowThirdParty) {
    try {
      const response = await fetch(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
      if (response.ok) {
        dataUrl = await blobToDataUrl(await response.blob());
      }
    } catch (e) {
      logger.debug("favicon DuckDuckGo 回退失败:", e);
    }
  }

  if (dataUrl != null) {
    const entry: FaviconCacheEntry = { dataUrl, updatedAt: Date.now() };
    await storage.local.set(`${FAVICON_CACHE_PREFIX}${hostKey}`, entry);
    // 成功即清除失败冷却。
    await storage.local.remove(`${FAIL_PREFIX}${hostKey}`);
    return true;
  }

  // 整条链路失败：记冷却，避免反复打不可达的网络。
  // 一并记下当时第三方是否可用，供上面「来源变多就重试」的判定使用。
  await storage.local.set(`${FAIL_PREFIX}${hostKey}`, {
    failedAt: Date.now(),
    thirdParty: allowThirdParty,
  } satisfies FaviconFailEntry);
  return false;
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图标失败"));
    reader.readAsDataURL(blob);
  });
}
