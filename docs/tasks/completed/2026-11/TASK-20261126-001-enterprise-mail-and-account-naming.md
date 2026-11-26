# TASK-20261126-001 · 企业邮箱预设与 MX 自动识别、侧边栏账户精简显示及双入口重命名闭环

- 状态：Completed
- 完成日期：2026-11-26
- 设计依据：`OmniMail-redesign.fig` -> 页面 `30 · 企业邮箱与账户命名规范`（Page ID: `1834033225:9`）

## 范围与方案

1. **Go 后端（`desktop/internal/mailproto` & `desktop/internal/accounts`）**
   - 在 `ListProviderPresets()` 中新增 6 家主流企业邮箱预设（`tencent_exmail`、`aliyun_exmail`、`netease_exmail`、`feishu`、`mail263`、`zoho_exmail`），保持 `imap` 兜底位于列表末尾；为 `ProviderPreset` 新增 `DetectedVia` 字段以回传命中的 MX 主机名。
   - 增强 `ResolveProviderByEmail`：标准后缀未命中时执行带 2.5s 超时的 `net.LookupMX` 查询并按 `Pref` 升序匹配腾讯企业邮、阿里企业邮、网易企业邮（自动区分 `hzmx` 华东节点与通用节点）、飞书 / Lark、263 企业邮、Zoho（中国/国际/欧盟节点）、Microsoft 365 与 Google Workspace。
   - 更新 `ShouldSendIMAPID` 支持 `netease_exmail` 与 `.qiye.163.com` 握手。
   - 新增 `accounts.ConciseProviderName`：`Create` 未传自定义名时默认使用精简品牌简称（`imap` 取邮箱域名）；`Update` 更新 `Name` 且未单独传 `ShortTag` 时自动截取前 10 个 rune 同步更新 `ShortTag`。

2. **前端目录、企业徽标与选型弹窗（`desktop/frontend/src`）**
   - 扩展 `ProviderId` 与 `ProviderCategory`（`enterprise`），拆分 `data/providersEnterprise.ts`、`i18n/providerCatalogEnEnterprise.ts` 及 `EnterpriseProviderGlyph.tsx` 品牌矢量徽标。
   - `AddAccountModal` / `AddAccountSidebar` / `AddAccountDirectory` / `AddAccountCards` 新增「企业邮箱」分类筛选、计数与「MX 域名探测」支持方式说明，并在企业邮箱网格下方提供 Microsoft 365 / Google Workspace OAuth 快捷入口条与自建邮局（Coremail / 华为云等）手动配置卡片。

3. **侧边栏精简显示与双入口重命名闭环**
   - 新增 `utils/accountDisplay.ts`：内置服务商统一采用无冗余“邮箱 / Mail / 邮件”后缀的精简简称，自动折叠老版本默认拼接名（如 `QQ 邮箱 · 1915992742`、`标准 IMAP / SMTP · xiarui`）并原样保留用户自定义名称；侧边栏第 2 行正常态直接展示真实邮箱地址，同时在写信发件人下拉、设置页卡片、命令面板与同步状态浮层复用统一标题解析。
   - 升级 `ProviderGuideModal` / `ManualImapModal`：支持 24 字显示名称与字数计数、快捷命名胶囊、失焦 MX 自动识别绿色胶囊提示、手动 IMAP 自动升级企业邮预设图标，以及左栏「侧边栏实时预览」卡片。
   - 双入口事后重命名：侧边栏账户行悬停铅笔按钮 + 右键菜单「重命名账户」唤起 `AccountRenamePopover.tsx`（支持回车保存、Esc 取消、快捷标签与恢复默认简称）；设置 -> 账户详情 `AccountIdentityFields.tsx` 新增「账户显示名称」三列并列编辑与保存闭环。

## 验证结果

- 单文件行数检查：全部新增与修改的前后端源码文件均严格 `<= 200` 行。
- `task verify`：通过（`gofmt`、Prettier、ESLint、`tsc --noEmit`、前端 99 项单测含新增 `account-display.test.mjs` 与扩展的 `add-account-modal.test.mjs` / `provider-connect-modal.test.mjs`、`go vet`、`go test ./...` 含新增 MX 识别与账户精简命名/重命名持久化单测）。
- `task build`：通过（Wails v3 绑定同步更新，前后端开发构建产物 `desktop/bin/omnimail.exe` 生成成功）。
