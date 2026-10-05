<script lang="ts">
  import {
    VAULT_TIMEOUT_OPTIONS,
    VaultTimeoutAction,
    VaultTimeoutType,
    type Settings,
    type VaultTimeout,
  } from "@/core/state/settings";
  import { sendMessage } from "@/platform/messaging";

  const {
    settings,
    onSaved,
    onBack,
  }: { settings: Settings; onSaved: (s: Settings) => void; onBack: () => void } = $props();

  async function updateTimeout(event: Event) {
    const raw = (event.currentTarget as HTMLSelectElement).value;
    const value: VaultTimeout = /^\d+$/.test(raw) ? Number(raw) : (raw as VaultTimeout);
    const saved = (await sendMessage("settings:save", { vaultTimeout: value })) ?? settings;
    onSaved(saved);
  }

  async function updateAction(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value as VaultTimeoutAction;
    const saved = (await sendMessage("settings:save", { vaultTimeoutAction: value })) ?? settings;
    onSaved(saved);
  }
</script>

<div class="subpage">
  <div class="subpage-head">
    <button class="back" onclick={onBack} aria-label="返回">‹</button>
    <h1>自动锁定</h1>
  </div>

  <section class="panel">
    <div class="field">
      <label for="timeout">锁定时机</label>
      <select
        id="timeout"
        value={String(settings.vaultTimeout)}
        onchange={updateTimeout}
        aria-describedby={settings.vaultTimeout === VaultTimeoutType.Never ? "never-warning" : undefined}
      >
        {#each VAULT_TIMEOUT_OPTIONS as option (option.value)}
          <option value={String(option.value)}>{option.label}</option>
        {/each}
      </select>
      {#if settings.vaultTimeout === VaultTimeoutType.Never}
        <p id="never-warning" class="hint invalid">
          重启后仍保持解锁。解锁密钥会以明文保存在本机，能读取浏览器数据的人可解密密码库。仅建议在个人可信设备上使用。
        </p>
      {/if}
    </div>

    <div class="field">
      <label for="action">超时后</label>
      <select id="action" value={settings.vaultTimeoutAction} onchange={updateAction}>
        <option value={VaultTimeoutAction.Lock}>锁定（保留数据）</option>
        <option value={VaultTimeoutAction.Clear}>清空（销毁本地数据）</option>
      </select>
      {#if settings.vaultTimeoutAction === VaultTimeoutAction.Clear}
        <p class="hint invalid">超时会永久删除本地密码库。请确认你已有导出备份。</p>
      {/if}
    </div>
  </section>
</div>
