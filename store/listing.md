# 商店上架文案

供 Chrome 应用商店开发者控制台复制粘贴。名称与摘要由 `public/_locales/` 自动本地化，
无需在控制台填写；本文件覆盖需要手工填写的字段。

---

## 一、单一用途说明（Single purpose）

控制台「隐私权规范 → 单一用途」字段。填英文即可。

### English

```
Vaultwarden Offline is a password manager. It stores the user's credentials
encrypted in local browser storage and fills them into web forms at the user's
request. Every feature — vault storage, unlocking, autofill, the password
generator, and TOTP codes — exists to serve that single purpose. The extension
has no account system, performs no synchronization, and transmits no user data
to any server.
```

### 中文（备用）

```
Vaultwarden Offline 是一款密码管理器。它将用户的登录凭据加密存放在浏览器本地存储中，
并在用户主动触发时填入网页表单。全部功能——密码库存储、解锁、自动填充、密码生成器、
动态验证码——都服务于这一个用途。本扩展没有账户体系，不进行任何同步，
也不向任何服务器传输用户数据。
```

---

## 二、详细描述 — 中文（zh_CN）

```
完全离线的密码库浏览器插件。无账户、无同步、无遥测——你的数据只存在自己的设备上。

数据来自 Bitwarden / Vaultwarden 的导出文件，导入后以 Bitwarden 同款密文格式存放在
浏览器本地，随时可以导出回去。数据不被锁死在本插件里。


■ 为什么选择它

・完全本地：没有服务器，也就没有服务器被攻破这回事
・格式互通：密文格式与 Bitwarden 官方一致，可与其他实现互相验证，不是黑盒
・代码可审计：GPL-3.0 全部开源，加密、存储、网络行为都能自己查
・密钥不出设备：主密码、PIN、加密密钥全部在本地派生与使用
・可随时离开：一键导出回 Vaultwarden / Bitwarden，不绑架你的数据


■ 主要功能

密码库
・8 种条目类型：登录、安全笔记、银行卡、身份、SSH 密钥、银行账户、驾照、护照
・文件夹、回收站、搜索与筛选、收藏、密码历史、附件（本地加密）
・条目级主密码复验：查看敏感条目前再确认一次身份

加密
・AES-256-CBC + HMAC-SHA256，与 Bitwarden 完全一致
・主密钥派生支持 PBKDF2-SHA256（默认 60 万次迭代）与 Argon2id
・主密码或 PIN 解锁；内置加密自检，可自行验证算法实现正确

自动填充
・表单采集覆盖 Shadow DOM 与 iframe
・输入框内联菜单、右键菜单、快捷键 Ctrl+Shift+L
・保存 / 更新凭据提示条（提示条本身绝不显示密码）
・按站点匹配度排序，匹配当前站点的条目自动置顶

生成器与验证码
・密码、密码短语（内置 EFF 词表）、用户名生成
・TOTP 动态验证码，通过 RFC 6238 官方测试向量验证，支持 Steam Guard

安全
・自动锁定：立即 / 指定分钟 / 浏览器重启 / 系统空闲 / 永不
・超时动作可选「锁定」或「销毁本地库」
・解锁失败递增延迟


■ 关于网络请求

本扩展不向任何服务器发送你的数据。唯一会发起的网络请求是获取网站图标，
且完全由你控制，在「设置 → 常规 → 网站图标」中三选一：

・完全关闭——一个图标请求都不发
・仅同源（默认）——只向你正在访问的那个站点索取它自己的图标，不涉及第三方
・同源 + 第三方回退——同源取不到时回退 Google / DuckDuckGo，需要你手动开启

第三方回退默认是关闭的。开启后，仅有站点域名会被发送给图标服务，
不包含用户名、密码、完整网址或密码库中的任何其他内容。

技术上，扩展的内容安全策略只放行上述图标服务域名，其余出网尝试会被浏览器直接拒绝；
构建流程还会扫描打包产物，出现未经豁免的网络调用即构建失败。


■ 请注意

・不提供多设备同步。需要同步请使用官方 Bitwarden 或自建 Vaultwarden。
・不支持团队共享、组织与集合。
・主密码一旦遗忘，密码库无法恢复——没有服务端托管，也就没有找回通道。
  请务必通过「设置 → 数据 → 导出」定期备份。
・本扩展与 Bitwarden Inc. 无隶属关系，是独立的第三方开源实现。


■ 开源

GPL-3.0，源码与隐私政策：
https://github.com/r0n9/vaultwarden-offline
```

---

## 三、详细描述 — English (en)

```
A fully offline password manager for your browser. No account, no sync, no
telemetry — your data lives only on your own device.

It reads Bitwarden / Vaultwarden export files and stores them locally in the
same ciphertext format Bitwarden uses, so you can export straight back out
whenever you want. Your data is never locked inside this extension.


■ Why this one

・Entirely local — there is no server, so there is no server to breach
・Interoperable format — ciphertext matches Bitwarden's official format and can
  be cross-verified against other implementations; nothing is a black box
・Auditable — fully open source under GPL-3.0; encryption, storage, and network
  behaviour are all yours to inspect
・Keys never leave the device — master password, PIN, and encryption keys are
  derived and used locally
・Leave any time — export back to Vaultwarden / Bitwarden in one step


■ Features

Vault
・8 item types: login, secure note, card, identity, SSH key, bank account,
  driver's licence, passport
・Folders, trash, search and filters, favourites, password history,
  locally encrypted attachments
・Per-item master password re-prompt before revealing sensitive entries

Encryption
・AES-256-CBC + HMAC-SHA256, identical to Bitwarden
・Key derivation via PBKDF2-SHA256 (600,000 iterations by default) or Argon2id
・Unlock with master password or PIN; a built-in self-test lets you verify the
  cryptographic primitives yourself

Autofill
・Form collection reaches into Shadow DOM and iframes
・Inline field menu, context menu, and a Ctrl+Shift+L shortcut
・Save / update prompts that never display the password itself
・Entries matching the current site are sorted to the top automatically

Generator and TOTP
・Password, passphrase (bundled EFF word list), and username generators
・TOTP codes verified against the official RFC 6238 test vectors,
  including Steam Guard

Security
・Auto-lock: immediately, after N minutes, on browser restart, on system idle,
  or never
・Timeout action: lock the vault, or destroy the local vault entirely
・Escalating delay after failed unlock attempts


■ About network requests

This extension sends none of your data to any server. The only network request
it ever makes is for website icons, and you decide how, under
Settings → General → Site icons:

・Off — no icon request is made at all
・Same-origin only (default) — asks the site you are already visiting for its
  own icon; no third party is involved
・Same-origin + third-party fallback — falls back to Google / DuckDuckGo when
  same-origin yields nothing; you must enable this yourself

The third-party fallback ships disabled. When enabled, only the bare domain is
sent to the icon service — never usernames, passwords, full URLs, or any other
vault content.

Technically, the extension's Content Security Policy permits only those icon
hosts and the browser rejects any other outbound attempt outright; the build
pipeline additionally scans the bundled output and fails the build if a
non-exempted network call is present.


■ Please note

・There is no multi-device sync. If you need sync, use official Bitwarden or
  self-hosted Vaultwarden.
・Team sharing, organizations, and collections are not supported.
・If you forget your master password, the vault cannot be recovered — there is
  no server-side custody and therefore no recovery path. Please back up
  regularly via Settings → Data → Export.
・This extension is not affiliated with Bitwarden Inc. It is an independent
  third-party open-source implementation.


■ Open source

GPL-3.0. Source code and privacy policy:
https://github.com/r0n9/vaultwarden-offline
```

---

## 四、其它控制台字段速查

| 字段 | 填写内容 |
|---|---|
| 类别 | Productivity（工具/效率） |
| 语言 | 英语 + 简体中文 |
| 隐私权政策网址 | `https://r0n9.github.io/vaultwarden-offline/` |
| 名称 / 摘要 | 自动取自 `public/_locales/`，控制台无需填写 |

权限理由逐条文案见 `docs/PRIVACY.md` 第 6 节，可直接复制。

---

## 五、待确认：摘要里的「不联网」

`public/_locales/*/messages.json` 的 `extDesc`（即商店摘要）目前写着：

- zh_CN：`……数据只存在你的设备上，不同步、不上传、不联网。`
- en：`……always offline, never synced or uploaded.`

严格地说，默认模式下扩展仍会向**用户正在访问的那个站点**发起同源请求获取图标，
所以「不联网 / always offline」是一个绝对化的表述，与实际行为存在细微出入。

这与本次 favicon 改造要解决的是同一类问题——描述与行为必须一致。是否收紧由你决定，
建议改法：

- zh_CN：`守护你的每一枚密码：本地加密存放，解锁快捷、随时取用。数据只存在你的设备上，不同步、不上传、无遥测。`
- en：`Protect every password. Your vault stays encrypted on your device — quick to unlock, never synced, never uploaded, zero telemetry.`

把「不联网 / always offline」换成「无遥测 / zero telemetry」，卖点强度基本不变，
但每个字都经得起对照代码检验。
