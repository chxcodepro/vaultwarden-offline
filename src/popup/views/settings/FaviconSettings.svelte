<script lang="ts">
  import { FAVICON_MODE_OPTIONS, FaviconMode, type Settings } from "@/core/state/settings";
  import { sendMessage } from "@/platform/messaging";

  const {
    settings,
    onSaved,
    onBack,
  }: { settings: Settings; onSaved: (s: Settings) => void; onBack: () => void } = $props();

  let clearing = $state(false);
  let notice = $state("");

  async function updateMode(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value as FaviconMode;
    const saved = (await sendMessage("settings:save", { faviconMode: value })) ?? settings;
    onSaved(saved);
    // 切换方式后旧的清除结果已无意义，避免留在屏幕上误导。
    notice = "";
  }

  async function clearCache() {
    clearing = true;
    try {
      const result = await sendMessage("favicon:clearCache");
      notice = `已清除 ${String(result?.removed ?? 0)} 项图标缓存。`;
    } finally {
      clearing = false;
    }
  }
</script>

<div class="subpage">
  <div class="subpage-head">
    <button class="back" onclick={onBack} aria-label="返回">‹</button>
    <h1>网站图标</h1>
  </div>

  <section class="panel">
    <div class="field">
      <label for="favicon-mode">获取方式</label>
      <select id="favicon-mode" value={settings.faviconMode} onchange={updateMode}>
        {#each FAVICON_MODE_OPTIONS as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
      <p class="hint">
        「仅同源」只向你正在访问的站点索取它自己的图标——你本来就在访问它，
        不产生任何额外的信息披露。取不到时显示按条目类型的默认图标。
      </p>
      {#if settings.faviconMode === FaviconMode.ThirdParty}
        <p class="warn">
          已开启第三方回退：同源取不到图标时，会把该站点的<strong>域名</strong>连同本机 IP
          发送给 Google 与 DuckDuckGo。这是本扩展唯一的对外网络请求。
        </p>
      {/if}
    </div>
  </section>

  <section class="panel">
    <button class="btn btn-secondary" onclick={clearCache} disabled={clearing}>
      {clearing ? "清除中…" : "清除已缓存图标"}
    </button>
    <p class="hint">删除本地缓存的全部站点图标与获取失败记录，不影响任何密码库条目。</p>
    {#if notice !== ""}
      <p class="notice">{notice}</p>
    {/if}
  </section>
</div>

<style>
  /* 隐私提示：沿用 .panel.danger 的红边红底语言，但作为段落内嵌在字段下方 */
  .warn {
    margin: 0;
    padding: 8px 10px;
    border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--border));
    border-radius: 6px;
    background: color-mix(in srgb, var(--danger) 5%, var(--surface));
    font-size: 11px;
    line-height: 1.6;
  }
</style>
