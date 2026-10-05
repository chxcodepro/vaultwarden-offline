# 隐私政策 / Privacy Policy

**Vaultwarden Offline**

最后更新 / Last updated: **2026-10-05**
适用版本 / Applies to: **v2026.8.6 及以后 / and later**

[中文](#中文) · [English](#english)

---

## 中文

### 一句话总结

**本扩展不收集、不上传、不出售你的任何数据。开发者收不到任何信息——因为本项目没有服务器。**

唯一的对外网络请求是获取网站图标（favicon），详见[第 4 节](#4-唯一的对外网络请求站点图标)。

---

### 1. 开发者收集的数据

**无。**

本项目不存在任何后端服务、账户体系、遥测或崩溃上报。开发者没有任何技术手段获取你的密码库、主密码、使用记录或设备信息。

具体而言，以下数据**从不离开你的设备**：

- 主密码、PIN 码
- 密码库中的任何条目（用户名、密码、TOTP 密钥、附注、附件、银行卡与身份信息等）
- 加密密钥（MasterKey、UserKey）
- 你访问过的网址、填充记录、搜索关键词
- 任何形式的使用统计或错误日志

### 2. 数据存储位置

所有数据仅存放在你本机的浏览器存储中。

| 位置 | 内容 | 是否加密 |
|---|---|---|
| `chrome.storage.local` → `vwo:vault:data` | 密码库主体（全部条目与文件夹） | ✅ 密文 |
| `chrome.storage.local` → `vwo:vault:meta` | KDF 参数、随机 salt、被包裹的 UserKey；若启用 PIN，还包括 PIN 专用 salt 与 PIN 包裹的 UserKey | ✅ 密钥为密文 |
| `chrome.storage.local` → `vwo:settings` | 用户设置（锁定超时、主题、自动填充开关等） | 明文（非敏感） |
| `chrome.storage.local` → `vwo:vault:unlock-throttle` | 解锁失败次数与冷却时间戳 | 明文（非敏感） |
| `chrome.storage.local` → `vwo:last-used-login` | 最近一次填充的条目 ID（不含任何凭据内容） | 明文（非敏感） |
| `chrome.storage.local` → `vwo:vault:remembered-userkey` | 仅选择「永不」锁定时保存的解锁密钥与密码库绑定信息；手动锁定、切回其他锁定方式或销毁密码库时删除 | **明文（敏感）** |
| `chrome.storage.local` → `vwo:favicons:{域名}` | 缓存的网站图标（data URL） | 明文（非敏感） |
| `chrome.storage.local` → `vwo:favicon-fail:{域名}` | 图标获取失败的冷却时间戳 | 明文（非敏感） |
| `chrome.storage.session` → `vwo:session:userkey` | 解锁后的运行期密钥；浏览器会话结束即自动清除 | 仅存于会话存储 |
| `chrome.storage.session` → `vwo:session:last-activity` | 最近活动时间戳，用于超时锁定 | 明文（非敏感） |
| IndexedDB 数据库 `vwo-attachments` | 条目附件的二进制内容 | ✅ 密文 |

此外，当保存/更新凭据的提示条被你点击「忽略」时，扩展会在**该网站页面自身的 `sessionStorage`** 中写入一个标记（键名形如 `vwo:declined:{主机名}:{用户名}`，值为 `1`），用于在本次浏览会话内不再重复打扰。该标记不含密码，且随标签页关闭而消失。

**「永不」锁定包含浏览器重启后保持解锁。** 此模式不保存主密码或 PIN，但会在本机保存可直接解密密码库的 UserKey。能读取浏览器配置数据的人可绕过主密码解密密码库，因此仅建议在个人可信设备上使用。默认仍为 15 分钟无操作后锁定，不保存此密钥；手动锁定后仍需主密码或 PIN 再次解锁。

### 3. 加密方式

- **对称加密**：AES-256-CBC + HMAC-SHA256（encrypt-then-MAC），与 Bitwarden / Vaultwarden 格式一致
- **密钥派生**：PBKDF2-SHA256（默认 600,000 次迭代）或 Argon2id（默认 iter=6、mem=32 MiB、par=4）
- **密钥层级**：主密码 → MasterKey → （HKDF 拉伸后）包裹/解开 UserKey → 逐字段加解密条目
- **主密码与 PIN 从不被存储**（哈希亦不存储）。密码是否正确，由解开 UserKey 包裹密文时的 MAC 校验决定

⚠️ **重要**：由于本扩展完全离线、不存在服务端托管，**主密码一旦遗忘，密码库将无法恢复**。请务必通过「设置 → 数据 → 导出」定期备份。

### 4. 唯一的对外网络请求：站点图标

为在列表中显示网站的真实图标，扩展会尝试获取 favicon。**获取方式由你自己决定**，在「设置 → 常规 → 网站图标」中可选三种：

| 选项 | 行为 |
|---|---|
| **完全关闭** | 不发起任何图标请求，一律显示按条目类型的默认图标 |
| **仅同源（默认）** | 只向你正在访问的那个站点索取它自己的图标，不涉及任何第三方 |
| **同源 + 第三方回退** | 同源取不到时，回退至 Google / DuckDuckGo |

**默认为「仅同源」。第三方回退默认关闭，必须由你显式开启。**

具体顺序：

1. **同源获取**（「仅同源」与「第三方回退」两种模式下均执行）：借助当前标签页的内容脚本，向你**正在访问的那个网站**请求其自身的图标（优先使用页面 `<link rel="icon">` 声明的地址，失败则尝试 `/favicon.ico`）。你本就在访问该站点，此步骤不涉及任何第三方，也不产生额外的信息披露。
2. **回退至 Google**（仅在你开启「第三方回退」后执行）：请求 `https://www.google.com/s2/favicons?domain={域名}&sz=64`。
3. **再回退至 DuckDuckGo**（同上）：请求 `https://icons.duckduckgo.com/ip3/{域名}.ico`。

**若你选择开启第三方回退，请明确知悉**：在第 2、3 步中，**你保存在密码库中的网站域名（例如 `example.com`）会被发送给 Google 或 DuckDuckGo**，同时这些请求会附带你的 IP 地址——这是任何 HTTP 请求的固有属性。

- 发送的**仅有域名本身**，不包含用户名、密码、完整网址、路径或密码库中的任何其他内容。
- 整条链路失败后进入 **6 小时冷却**，期间不再重试。
- 获取时机：新增条目时，以及当前站点出现匹配条目时；均为静默后台执行，不阻塞任何交互。
- 设置页提供「清除已缓存图标」，可随时删除本地缓存的全部图标与失败记录。

第三方隐私政策：
[Google 隐私权政策](https://policies.google.com/privacy) · [DuckDuckGo 隐私政策](https://duckduckgo.com/privacy)

**技术层面的约束**：扩展的 manifest 中，内容安全策略（CSP）的 `connect-src` 仅放行上述三个域名，其余任何出网尝试都会被浏览器直接拒绝。此外，构建流程会扫描**打包产物**，一旦出现未经豁免的 `fetch` / `XMLHttpRequest` / `WebSocket` / `sendBeacon` 等调用，构建即失败。

### 5. 自动填充如何处理页面数据

- 字段采集脚本**不常驻**任何页面，仅在你主动触发填充或检测时，由扩展临时注入执行。
- 采集内容仅为表单结构信息（字段类型、name/id/placeholder、标签文本、可见性等），用于判定"哪个框是用户名、哪个是密码"。这些信息**不被存储、不被上传**，用完即弃。
- **明文密码只在「扩展后台 → 网页」这一跳中出现**，不经过扩展弹窗界面（弹窗仅传递条目 ID）。
- 常驻的内容脚本仅有两个：保存提示条与输入框内联菜单。前者在你提交表单时读取用户名与密码并交给后台判断是否需要提示保存；后者只显示条目名称与用户名，**绝不含密码**。
- 保存/更新提示条**绝不显示密码**。

### 6. 权限用途说明

| 权限 | 用途 |
|---|---|
| `storage` | 存储加密后的密码库与用户设置 |
| `unlimitedStorage` | 条目附件为加密二进制，可能超出默认存储配额 |
| `activeTab`、`scripting` | 在你主动触发填充时，向当前页面注入采集与填充脚本 |
| `tabs` | 读取当前标签页网址，以匹配对应的登录条目并更新图标角标 |
| `contextMenus` | 提供右键菜单填充入口 |
| `alarms` | 周期性检查无操作时长，到时自动锁定密码库 |
| `idle` | 当你选择「系统空闲时锁定」时，检测系统空闲状态 |
| `clipboardWrite` | 将用户名 / 密码 / 验证码复制到剪贴板（仅在你点击复制时） |
| `host_permissions`（`http`/`https`/`file`） | 自动填充需要在你访问的任意站点上运行；`file://` 需你在扩展详情页手动开启「允许访问文件网址」后才生效 |

### 7. 剪贴板

点击复制按钮时，扩展会将对应内容写入系统剪贴板。**本版本不提供剪贴板自动清除功能**，复制的内容会一直保留在剪贴板中，直至被其他内容覆盖。复制密码后请注意及时清理。

### 8. 数据的导出与删除

- **导出**：设置 → 数据 → 导出，支持 JSON（明文 / 密码保护）与 CSV，格式与 Bitwarden 官方一致，可直接导回 Bitwarden / Vaultwarden。
- **清空条目**：设置 → 数据 → 清空密码库数据（保留主密码与 PIN，得到空库）。
- **彻底销毁**：设置 → 数据 → 销毁本地密码库，或直接从浏览器卸载本扩展。卸载会一并移除扩展的全部存储数据，**此操作不可恢复**。

### 9. 第三方服务与数据共享

除第 4 节所述的图标获取外，本扩展**不与任何第三方共享数据**，不接入任何分析、广告、崩溃上报或 A/B 测试服务，不出售或转让任何数据。

### 10. 儿童隐私

本扩展不收集任何用户数据，因此也不会收集儿童的个人信息。

### 11. 政策变更

本政策的任何修改都会更新本文顶部的日期，并通过 [Git 提交历史](https://github.com/r0n9/vaultwarden-offline/commits/main/docs/PRIVACY.md)完整留痕，可供随时查阅比对。

### 12. 联系方式

问题、疑虑或安全报告，请通过 GitHub Issues 提交：
<https://github.com/r0n9/vaultwarden-offline/issues>

本项目基于 **GNU GPL-3.0** 完全开源，上述所有陈述均可通过阅读源码验证：
<https://github.com/r0n9/vaultwarden-offline>

---

## English

### In one sentence

**This extension collects nothing, uploads nothing, and sells nothing. The developer receives no information whatsoever — because this project has no server.**

The only outbound network request is for website icons (favicons); see [Section 4](#4-the-only-outbound-network-request-site-favicons).

---

### 1. Data collected by the developer

**None.**

There is no backend service, no account system, no telemetry, and no crash reporting. The developer has no technical means of accessing your vault, master password, usage history, or device information.

Specifically, the following **never leave your device**:

- Master password and PIN
- Any vault item (usernames, passwords, TOTP secrets, notes, attachments, cards, identities, etc.)
- Encryption keys (MasterKey, UserKey)
- URLs you visit, autofill history, or search queries
- Usage statistics or error logs of any kind

### 2. Where data is stored

All data resides solely in your local browser storage.

| Location | Contents | Encrypted |
|---|---|---|
| `chrome.storage.local` → `vwo:vault:data` | The vault itself (all items and folders) | ✅ Ciphertext |
| `chrome.storage.local` → `vwo:vault:meta` | KDF parameters, random salt, wrapped UserKey; plus PIN salt and PIN-wrapped UserKey if a PIN is set | ✅ Keys are ciphertext |
| `chrome.storage.local` → `vwo:settings` | Preferences (lock timeout, theme, autofill toggles) | Plaintext (non-sensitive) |
| `chrome.storage.local` → `vwo:vault:unlock-throttle` | Failed unlock count and cooldown timestamp | Plaintext (non-sensitive) |
| `chrome.storage.local` → `vwo:last-used-login` | ID of the most recently filled item (no credential content) | Plaintext (non-sensitive) |
| `chrome.storage.local` → `vwo:vault:remembered-userkey` | Unlock key and vault binding, saved only with "Never" locking; removed on manual lock, switching to another lock policy, or vault destruction | **Plaintext (sensitive)** |
| `chrome.storage.local` → `vwo:favicons:{domain}` | Cached site icon (data URL) | Plaintext (non-sensitive) |
| `chrome.storage.local` → `vwo:favicon-fail:{domain}` | Cooldown timestamp after a failed icon fetch | Plaintext (non-sensitive) |
| `chrome.storage.session` → `vwo:session:userkey` | Runtime key after unlocking; cleared automatically when the browser session ends | Session storage only |
| `chrome.storage.session` → `vwo:session:last-activity` | Last activity timestamp, used for timeout locking | Plaintext (non-sensitive) |
| IndexedDB database `vwo-attachments` | Binary contents of item attachments | ✅ Ciphertext |

Additionally, when you click "Ignore" on a save/update prompt, the extension writes a marker into **the website page's own `sessionStorage`** (key of the form `vwo:declined:{hostname}:{username}`, value `1`) so it will not prompt you again during that browsing session. The marker contains no password and disappears when the tab is closed.

**"Never" locking keeps the vault unlocked across browser restarts.** It does not store the master password or PIN, but it stores a UserKey that can decrypt the vault directly. Anyone who can read the browser profile data can bypass the master password and decrypt the vault, so use this only on a trusted personal device. The default remains a 15-minute inactivity lock without a saved key; after a manual lock, the master password or PIN is required again.

### 3. Encryption

- **Symmetric encryption**: AES-256-CBC + HMAC-SHA256 (encrypt-then-MAC), identical to the Bitwarden / Vaultwarden format
- **Key derivation**: PBKDF2-SHA256 (600,000 iterations by default) or Argon2id (default iter=6, mem=32 MiB, par=4)
- **Key hierarchy**: master password → MasterKey → (HKDF-stretched) wraps/unwraps the UserKey → per-field encryption of items
- **The master password and PIN are never stored** (not even as a hash). Correctness is determined by whether the MAC verifies when unwrapping the UserKey

⚠️ **Important**: Because the extension is fully offline with no server-side custody, **a forgotten master password means the vault cannot be recovered**. Please back up regularly via Settings → Data → Export.

### 4. The only outbound network request: site favicons

To display real website icons in lists, the extension attempts to fetch favicons. **You decide how**, under Settings → General → Site icons, with three choices:

| Option | Behaviour |
|---|---|
| **Off** | No icon request is ever made; every item shows its type's default icon |
| **Same-origin only (default)** | Asks only the site you are currently visiting for its own icon; no third party involved |
| **Same-origin + third-party fallback** | Falls back to Google / DuckDuckGo when same-origin yields nothing |

**The default is same-origin only. The third-party fallback is off by default and must be enabled by you explicitly.**

The order in detail:

1. **Same-origin** (runs in both the "same-origin only" and "third-party fallback" modes): via the current tab's content script, it requests the icon from **the website you are already visiting** (preferring the address declared in the page's `<link rel="icon">`, falling back to `/favicon.ico`). You are already visiting that site, so no third party is involved and no additional information is disclosed.
2. **Google fallback** (only once you have enabled the third-party fallback): requests `https://www.google.com/s2/favicons?domain={domain}&sz=64`.
3. **DuckDuckGo fallback** (likewise): requests `https://icons.duckduckgo.com/ip3/{domain}.ico`.

**If you choose to enable the third-party fallback, please be explicitly aware**: in steps 2 and 3, **a domain name saved in your vault (e.g. `example.com`) is sent to Google or DuckDuckGo**, and these requests carry your IP address — an inherent property of any HTTP request.

- **Only the bare domain** is sent — never usernames, passwords, full URLs, paths, or any other vault content.
- After the whole chain fails, a **6-hour cooldown** applies before retrying.
- Timing: when an item is added, and when a matching item appears for the current site. Both run silently in the background and block no interaction.
- The settings screen offers "Clear cached icons", removing every locally cached icon and failure record at any time.

Third-party privacy policies:
[Google Privacy Policy](https://policies.google.com/privacy) · [DuckDuckGo Privacy Policy](https://duckduckgo.com/privacy)

**Technical enforcement**: the extension's Content Security Policy allows `connect-src` to exactly those three hosts and nothing else — any other outbound attempt is rejected outright by the browser. In addition, the build pipeline scans the **bundled output** and fails the build if any non-exempted `fetch` / `XMLHttpRequest` / `WebSocket` / `sendBeacon` call is present.

### 5. How autofill handles page data

- Field-collection scripts are **not persistently present** on any page; they are injected temporarily only when you actively trigger a fill or a field detection.
- What is collected is form structure only (field types, name/id/placeholder, label text, visibility) in order to determine which box is the username and which is the password. This information is **never stored and never uploaded**; it is discarded immediately after use.
- **Plaintext passwords appear only on the hop from the extension's background service worker to the web page** — never through the popup UI (the popup passes only an item ID).
- Only two content scripts run persistently: the save prompt and the inline field menu. The former reads the username and password when you submit a form and hands them to the background worker to decide whether to offer to save; the latter displays only item names and usernames and **never contains passwords**.
- The save/update prompt **never displays a password**.

### 6. Permission justifications

| Permission | Purpose |
|---|---|
| `storage` | Store the encrypted vault and user preferences |
| `unlimitedStorage` | Item attachments are encrypted binaries that may exceed the default quota |
| `activeTab`, `scripting` | Inject collection and fill scripts into the current page when you trigger autofill |
| `tabs` | Read the current tab's URL to match the corresponding login item and update the toolbar badge |
| `contextMenus` | Provide a right-click menu entry for filling |
| `alarms` | Periodically check idle duration and lock the vault when the timeout is reached |
| `idle` | Detect system idle state when you choose "lock when the system is idle" |
| `clipboardWrite` | Copy username / password / verification code to the clipboard (only when you click copy) |
| `host_permissions` (`http`/`https`/`file`) | Autofill must be able to run on any site you visit; `file://` takes effect only after you manually enable "Allow access to file URLs" on the extension's details page |

### 7. Clipboard

When you click a copy button, the extension writes the corresponding value to the system clipboard. **This version does not provide automatic clipboard clearing** — copied content remains on the clipboard until overwritten. Please clear it yourself after copying a password.

### 8. Exporting and deleting your data

- **Export**: Settings → Data → Export. Supports JSON (plaintext / password-protected) and CSV, in the official Bitwarden format, importable straight back into Bitwarden / Vaultwarden.
- **Clear items**: Settings → Data → Clear vault data (keeps your master password and PIN, leaving an empty vault).
- **Destroy completely**: Settings → Data → Destroy local vault, or simply uninstall the extension from your browser. Uninstalling removes all of the extension's stored data. **This is irreversible.**

### 9. Third parties and data sharing

Apart from the favicon fetching described in Section 4, this extension **shares no data with any third party**. It integrates no analytics, advertising, crash reporting, or A/B testing services, and neither sells nor transfers any data.

### 10. Children's privacy

The extension collects no user data of any kind, and therefore collects no personal information from children.

### 11. Changes to this policy

Any change to this policy updates the date at the top of this document and is fully recorded in the [Git commit history](https://github.com/r0n9/vaultwarden-offline/commits/main/docs/PRIVACY.md), available for inspection and comparison at any time.

### 12. Contact

For questions, concerns, or security reports, please open a GitHub issue:
<https://github.com/r0n9/vaultwarden-offline/issues>

This project is fully open source under the **GNU GPL-3.0**; every statement above can be verified by reading the source:
<https://github.com/r0n9/vaultwarden-offline>
