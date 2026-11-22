# TASK-20261120-002：按高保真设计图完整实现 OmniMail 前端界面

## 状态

Completed

## 原始需求

1. 严格按照 `E:\go\高保真设计图\OmniMail\OmniMail-redesign.fig` 完整实现 OmniMail 桌面端前端界面，不做偏离设计图的自由发挥。
2. 仅完成前端界面与交互状态，不修改 Go 后端业务逻辑与真实邮箱协议实现。
3. 将「前后端手写代码文件单个不超过 200 行，采用树状分层文件夹设计」写入项目规范文档并严格落实。

## 范围与方案

- 仅改造 `desktop/frontend/` 前端代码以及工程规范与状态文档，保留现有 Go 后端与绑定代码不变。
- 导入高保真设计图内嵌的 7 个官方服务商图标 PNG 与 `brand-logo` SVG 至 `desktop/frontend/src/assets/`，并在 `desktop/frontend/src/styles/tokens.css` 落地完整亮/暗双模式设计变量。
- 按功能域采用树状分层结构组织代码：`types/`、`data/`（含 `data/mails/`）、`state/`、`styles/`、`components/`（`common/`、`shell/`、`mail/`、`mail/reader/`、`ai/`、`compose/`、`onboarding/`、`settings/`、`contacts/`、`overlays/`）。

## 实际结果

- **规则文档更新**：更新 [AGENTS.md](../../../../AGENTS.md) 与 [编码规范](../../../development/CODING_RULES.md)，明确前后端手写源码文件单文件 `<= 200` 行及按业务模块树状分层目录要求。
- **高保真前端完整实现**：在 `desktop/frontend/src/` 下共落盘 121 个手写 `.ts` / `.tsx` / `.css` 文件（全部 `<= 200` 行），忠实还原设计图全部 24 页视图与交互状态：
  - 首次引导与协议条款（`OnboardingScreen`、`LegalDocModal`）、邮箱接入流（`AddAccountModal`、`ProviderGuideModal`、`OAuthFlowModal`、`ManualImapModal`、`SyncProgressModal`）。
  - 主工作台壳层（`TopBar`、`Sidebar`、`SidebarAccountsAndLabels`、`StatusBanner`）与 4 栏/响应式（1728 / 1280 / 1024）邮件工作区（`MailListPane`、`MailCard`、`MailContextMenu`、`MailReaderPane`、`ReaderToolbar`、`ReaderThreadCard`、`MeetingInviteCard`、`ReaderSecurityBanners`、`ReaderAttachmentsSection`、`QuickReplyBox`）。
  - Omni AI 副驾驶侧栏与逐次透明授权（`AiPane`、`AiInsightContent`、`AiStatusPanel`、`AiConsentModal`）。
  - 写信与最小化草稿 Dock、内联 AI 改写、定时发送（`ComposeModal`、`ComposeDock`、`ComposeInlineAiBar`、`ScheduleSendModal`）。
  - 偏好设置 11 个分类与账号详情（`SettingsModal`、`GeneralTab`、`AccountsTab`、`AccountDetailView`、`SyncTab`、`ComposeTab`、`RulesTab`、`AutoReplyTab`、`AiSettingsTab`、`PrivacyAndStorageTabs`、`ShortcutsAndAboutTabs`）。
  - 联系人与黑名单工作区（`ContactsWorkspace`、`ContactsSidebar`、`ContactDetailPanel`、`BlacklistManagerView`、`ContactEditModal`）。
  - 全部辅助浮层：命令面板（`Cmd/Ctrl+K`）、高级搜索、标签管理、移动文件夹、稍后处理、收件规则编辑、邮件源码/打印导出、附件预览/传输队列、系统诊断/发件队列、备份迁移、更新流、托盘与通知预览、高危二次确认及 Toast 撤销提示。
- **双主题与样式完备性**：按模块化拆分为 17 个样式文件并在 `main.tsx` 按级联顺序引入；支持浅色与 Obsidian Slate 深色双模式切换；经自动化 JSX-CSS 类名扫描确认无缺失样式类。
- **关联文档更新**：同步更新 [当前状态](../../../plans/CURRENT.md)。

## 验证与限制

- **文件行数核查**：脚本检查 `desktop/frontend/src/` 下全部 121 个手写 `.ts` / `.tsx` / `.css` 文件，`> 200` 行的文件数为 `0`（最大为 196 行）；同时 `desktop/` 下现有手写 Go 源码均 `<= 200` 行。
- **完整校验通过**：执行 `task format` 与 `task verify` 全部通过（exit code 0）：
  - `wails3 generate bindings` 成功；
  - `gofmt` 与 `prettier --check .` 通过；
  - `eslint .` 与 `tsc --noEmit` 零错误通过；
  - `vite build --minify false --mode development` 打包成功（166 modules）；
  - `go vet ./...`、`go test ./...`、`go build -o bin/omnimail.exe .` 全部通过。
- **未验证事项**：遵循协作规则，本次未启动桌面应用窗口做可视化截图或原生 WebView 点击实测，未制作发布包，也未创建 Git 提交。
- **Git 提交**：本记录与实现纳入同一个提交。可用 `git log --diff-filter=A --format=%h -- docs/tasks/completed/2026-11/TASK-20261120-002-omnimail-frontend-ui.md` 查询实现提交号。
