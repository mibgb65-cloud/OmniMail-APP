# TASK-20261121-002：按 Responsive-Layouts 设计规范完成多断点响应式与溢出治理

## 状态

Completed

## 原始需求

1. 基于 `E:\go\高保真设计图\OmniMail\OmniMail-redesign.fig` 的 `Responsive-Layouts` 画板与 `Responsive & Overflow Spec` 规范卡，完整实现前端三断点（`>= 1440px`、`1025px ~ 1439px`、`<= 1024px`）响应式布局与溢出治理。
2. 桌面最小窗口约束设为 `minWidth: 960, minHeight: 640`，根容器强制 `height: 100vh; overflow: hidden;`，全局严禁出现横向滚动条（`overflow-x: hidden`），所有 Flex 子项满足 `min-width: 0; min-height: 0;`。
3. 落地顶栏搜索框分段限宽与左右拖拽留白、固定区/独立纵滚区契约、文本单行截断、小屏 `60px` Icon-Only Rail + `248px` 超紧凑邮件列表、小屏右侧 `320px` AI 浮层抽屉与左侧 `228px` 导航浮层抽屉、通用弹窗 `min(原宽, calc(100vw - 48px)) × calc(100vh - 48px)`（写信正文可见高度 `>= 240px`）以及通讯录紧凑表格列合并降级，完整兼容亮/暗双主题。

## 实际结果

- **桌面窗口约束**：更新 [desktop/main.go](../../../../desktop/main.go)，设置默认尺寸 `1440×900` 与最小约束 `MinWidth: 960, MinHeight: 640`。
- **三断点与抽屉状态管理**：新增 [useViewportMode.ts](../../../../desktop/frontend/src/state/useViewportMode.ts) 响应式视口状态，更新 [useAiStore.ts](../../../../desktop/frontend/src/state/useAiStore.ts)（Omni AI 默认收起）、[useWorkspaceStore.ts](../../../../desktop/frontend/src/state/useWorkspaceStore.ts) 与 [AppContext.tsx](../../../../desktop/frontend/src/state/AppContext.tsx)（`leftNavOpen` 抽屉开关与 `Esc` 优先收起机制）。
- **主工作区壳层、Icon Rail 与双浮层抽屉**：重构 [App.tsx](../../../../desktop/frontend/src/App.tsx)、[TopBar.tsx](../../../../desktop/frontend/src/components/shell/TopBar.tsx)、[Sidebar.tsx](../../../../desktop/frontend/src/components/shell/Sidebar.tsx)、[SidebarAccountsAndLabels.tsx](../../../../desktop/frontend/src/components/shell/SidebarAccountsAndLabels.tsx)、[AiPane.tsx](../../../../desktop/frontend/src/components/ai/AiPane.tsx)，新增 [SidebarIconRail.tsx](../../../../desktop/frontend/src/components/shell/SidebarIconRail.tsx) 与 [LeftNavDrawer.tsx](../../../../desktop/frontend/src/components/shell/LeftNavDrawer.tsx)。
- **邮件列表与阅读区紧凑降级**：重构 [MailListPane.tsx](../../../../desktop/frontend/src/components/mail/MailListPane.tsx)、[MailCard.tsx](../../../../desktop/frontend/src/components/mail/MailCard.tsx)、[ReaderToolbar.tsx](../../../../desktop/frontend/src/components/mail/reader/ReaderToolbar.tsx)、[ReaderMoreMenu.tsx](../../../../desktop/frontend/src/components/mail/reader/ReaderMoreMenu.tsx)、[ReaderThreadCard.tsx](../../../../desktop/frontend/src/components/mail/reader/ReaderThreadCard.tsx)、[ReaderAttachmentsSection.tsx](../../../../desktop/frontend/src/components/mail/reader/ReaderAttachmentsSection.tsx)、[QuickReplyBox.tsx](../../../../desktop/frontend/src/components/mail/reader/QuickReplyBox.tsx)（中/小屏单行紧凑回复栏，点击/聚焦展开；小屏隐藏列表摘要并默认隐藏未勾选多选框）。
- **通用弹窗、写信编辑器与通讯录紧凑表格**：更新 [ModalShell.tsx](../../../../desktop/frontend/src/components/common/ModalShell.tsx)、[SettingsModal.tsx](../../../../desktop/frontend/src/components/settings/SettingsModal.tsx)、[ComposeModal.tsx](../../../../desktop/frontend/src/components/compose/ComposeModal.tsx)、[ContactsWorkspace.tsx](../../../../desktop/frontend/src/components/contacts/ContactsWorkspace.tsx)、[ContactsSidebar.tsx](../../../../desktop/frontend/src/components/contacts/ContactsSidebar.tsx)、[ContactDetailPanel.tsx](../../../../desktop/frontend/src/components/contacts/ContactDetailPanel.tsx)，并新增 [ContactsTableRows.tsx](../../../../desktop/frontend/src/components/contacts/ContactsTableRows.tsx)。
- **分层样式与断点体系**：重构布局与模块样式，并新增 [drawers.css](../../../../desktop/frontend/src/styles/drawers.css)、[responsive-laptop.css](../../../../desktop/frontend/src/styles/responsive-laptop.css)、[responsive.css](../../../../desktop/frontend/src/styles/responsive.css)。

## 验证与限制

- **源码行数核查**：全仓 134 个手写 `.go` / `.ts` / `.tsx` / `.css` 文件全部 `<= 200` 行（`> 200` 行文件数为 `0`）。
- **工程构建校验**：执行 `task format` 与 `task verify`（含绑定生成、Prettier、ESLint、`tsc --noEmit`、Vite 构建、`go vet`、`go test`、`go build`）零错误通过，已重新生成 `desktop/bin/omnimail.exe`。
- **多视口浏览器实测**：启动本地预览并在 `1440×900`、`1280×720`、`960×640` 三视口（亮/暗双模式、小屏 AI 浮层抽屉 `320px`、左导航浮层抽屉 `228px`、设置弹窗 `912×592`、写信弹窗 `912×592`、通讯录 `60px + 876px`）逐一校验：
  - `document.documentElement.scrollWidth <= window.innerWidth` 全部通过（零横向滚动条）；
  - 顶栏（`54 / 50 / 48`）、搜索框（`460 / 380 / 300`）、分栏（`224+328+844` / `196+292+756` / `60+248+620`）尺寸与独立纵滚契约全部精确匹配设计规范。
- **Git 提交**：本记录与实现纳入同一个提交。可用 `git log --diff-filter=A --format=%h -- docs/tasks/completed/2026-11/TASK-20261121-002-responsive-ui-overhaul.md` 查询实现提交号。
