# 商店测试说明（Test instructions）

供 Chrome 应用商店开发者控制台「测试说明」字段使用。
本扩展**没有账户体系**，不存在「输入用户名和密码登录」这一流程——
所有数据在本地创建、留在设备上。以下是审核员可完整走通核心功能的路径。

建议提交英文版；中文版备查。完整版 1870 字符适用于 2000 上限的主字段；
若表单对应字段上限为 500 字符，使用文末的浓缩版。

---

## English（提交用）

```
This extension has no account system — there is no sign-in with a username
or password. All data is created locally and stays on the device.

1. INSTALL (if not auto-installed): unzip, open chrome://extensions, enable
   Developer mode, click "Load unpacked", select the unzipped folder.

2. FIRST RUN: click the toolbar icon. On the "no vault" screen choose
   "Create vault", set a master password (8+ chars, letters AND digits —
   e.g. TestPass123), confirm. The vault unlocks immediately.

3. ADD A TEST LOGIN: tap +, type "Login", enter any name, username and
   password, set the URL to https://httpbin.org, save.

4. AUTOFILL: open https://httpbin.org/forms/post in the same tab. Click the
   username field — an inline ⚡ menu appears; pick the test item and both
   fields are filled. (Or right-click the page → Vaultwarden Offline →
   Fill.)

5. OTHER CORE FEATURES:
   - Lock / unlock: click the padlock in the popup, unlock with the master
     password.
   - Password generator: "Generator" tab in the popup generates and copies
     a password.
   - Save prompt: on httpbin.org/forms/post type a username and password and
     submit — a banner offers to save the credentials.
   - Site icons: Settings → General → Site icons offers three modes
     (Off / Same-origin only / Same-origin + third-party fallback); the
     third-party fallback is off by default.
   - Export: Settings → Data → Export produces a Bitwarden-compatible
     JSON / CSV.

NOTES:
- The master password cannot be recovered if forgotten — data is encrypted
  only on the device. Keep TestPass123 during testing.
- After 3 failed unlock attempts, unlocking is throttled with an escalating
  delay (up to 5 minutes). Avoid repeated wrong passwords.
- No network requests by default (icons are same-origin only); file://
  pages require "Allow access to file URLs" enabled manually.
```

---

## 中文（备查）

```
本扩展没有账户体系——不存在用用户名和密码登录的流程。所有数据在本地创建，只留在设备上。

1. 安装（若未自动安装）：解压安装包，打开 chrome://extensions，开启开发者模式，
   点「加载已解压的扩展程序」，选择解压后的文件夹。

2. 首次使用：点击工具栏上的扩展图标。在「尚无密码库」界面选择「创建密码库」，
   设置主密码（至少 8 位，必须同时包含字母和数字，例如 TestPass123）并确认。
   密码库随即处于解锁状态。

3. 添加测试条目：点 + 按钮，类型选「登录」，任意填写名称、用户名、密码，
   网址填 https://httpbin.org，保存。

4. 自动填充：在同一标签页打开 https://httpbin.org/forms/post，点击用户名字段——
   字段旁会出现 ⚡ 内联菜单，点你的测试条目，用户名与密码即被填入。
   （替代方式：右键页面 → Vaultwarden Offline → 填充。）

5. 其他核心功能：
   - 锁定 / 解锁：点击弹窗中的锁图标，再用主密码解锁。
   - 密码生成器：打开弹窗的「生成器」标签，可生成并复制密码。
   - 保存提示条：在 httpbin.org/forms/post 上填写用户名与密码并提交表单，
     页面顶部会出现保存提示条。
   - 网站图标：设置 → 常规 → 网站图标提供三档（完全关闭 / 仅同源 /
     同源 + 第三方回退），第三方回退默认关闭。
   - 导出：设置 → 数据 → 导出，产出与 Bitwarden 兼容的 JSON / CSV。

注意事项：
- 主密码遗忘无法恢复——数据仅在本机加密。测试期间请记住 TestPass123。
- 连续输错 3 次后解锁会被节流，等待时间递增（最长 5 分钟），请勿反复输错。
- 默认不发起任何网络请求（图标仅同源）；扩展需要主机权限才能在任意站点运行，
  file:// 页面需在扩展详情页手动开启「允许访问文件网址」。
```

---

## 500 字符浓缩版（用于上限 500 的字段）

保留的优先级：无账户说明 → 创建密码库 → 自动填充路径 → 两个最易踩坑的警告
（主密码不可恢复、解锁节流）。

### English

```
No account system — no login. Click the toolbar icon → "Create vault", set a
master password (e.g. TestPass123). Add a login item with URL
https://httpbin.org. Open https://httpbin.org/forms/post, click the username
field, pick the item from the ⚡ menu — fields are filled. Password generator:
"Generator" tab. Remember the master password — it cannot be recovered. After
3 failed unlock attempts, unlocking is throttled (up to 5 minutes).
```

### 中文

```
无账户体系，无需登录。点击工具栏图标 → 创建密码库，设置主密码（如 TestPass123）。
添加一条登录条目，网址填 https://httpbin.org。打开 https://httpbin.org/forms/post，
点击用户名字段，在 ⚡ 菜单选择该条目即完成填充。生成器标签可生成密码。
主密码遗忘无法恢复，请牢记。连续输错 3 次解锁会被节流（最长 5 分钟）。
```

---

## 给审核员的要点设计

| 设计点 | 说明 |
|---|---|
| 无账户体系的替代路径 | 商店提示语默认假设有登录流程；此处明确改写为「创建本地密码库」，并给出具体主密码示例，避免审核员在登录环节卡住 |
| 用 httpbin.org 做自动填充靶场 | 这是公开稳定的表单页，审核员无需配置任何东西；不依赖仓库内 test/pages（zip 里没有） |
| 节流警告 | 审核员最容易触发的坑就是连输错密码——3 次后最长等 5 分钟，会拖慢审核，提前写清楚 |
| 主密码不可恢复 | 既是测试提示，也是产品边界的一次重申 |
| 覆盖数据披露声明 | 默认无网络请求、仅同源取图标、第三方回退需显式开启，与隐私政策第 4 节口径一致 |
