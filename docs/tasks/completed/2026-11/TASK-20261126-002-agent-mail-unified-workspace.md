# TASK-20261126-002 · 智能体邮箱（WorkBuddy & Muse）统一三栏工作台重构

- 状态：Completed
- 完成日期：2026-11-26
- 设计依据：`OmniMail-redesign.fig` -> 页面 `31 · 智能体邮箱统一主界面规范`（亮色 `1834033225:1932` / 暗色 `1834033225:2162`）

## 范围与方案

1. **三栏工作台布局对齐（消除二层顶栏与右侧空白）**
   - 重构 `WorkBuddyMailView.tsx` 与 `workbuddy-mail.css`：彻底移除独立二层顶栏 `.wb-topbar-card`、嵌套 `.wb-columns` 以及误写的 `grid-column: 2 / -1`，将 `.wb-view-root` 设为横向 `flex: 1; min-width: 0; min-height: 0; display: flex; gap: var(--workspace-column-gap); overflow: hidden;`，使 `<WorkBuddyListPane />`（`328px`）与 `<WorkBuddyReaderPane />`（`flex: 1`）作为并列 `.panel-card` 与左侧边栏顶线 100% 齐平并完整撑满右侧窗口。
   - `activeError` 改为在列表栏头部下方以内联提示条 `.wb-inline-alert` 紧凑呈现（支持 `ERR_WB_AUTH_REQUIRED` 一键重新授权），不破坏三栏顶线对齐。
   - 同步重构 `MuseMailView.tsx`、`MuseThreadListPane.tsx`、`MuseThreadReaderPane.tsx`、`MuseMessageCard.tsx` 与 `muse-mail.css` / `muse-mail-reader.css`，移除 `.muse-topbar-card`，统一收口刷新、断开连接、复制地址与上下会话切换至列表头与阅读器工具栏。

2. **地址与时间解析纯函数（`utils/agentMailFormat.ts`）**
   - `parseMailAddressDisplay`：解析 `DisplayName <addr@domain>` 与纯邮箱格式，列表卡片仅展示干净发件人名称，不再拼接 `<email>`。
   - `formatAgentMailTime`：将 ISO-8601 时间戳转换为本地时区可读格式（列表：`今天 HH:mm` / `昨天` / `MM-dd` / `yyyy-MM-dd`；详情：`M 月 D 日 HH:mm` / `Nov 26, 16:51`），彻底消除 `T...Z` 裸露。
   - `resolveConciseAgentTitle` 与 `buildAgentReplySubject`：折叠冗余“智能体邮箱”后缀并规范构造 `Re:` 回复主题。

3. **WorkBuddy 列表栏、阅读器与常规邮箱回信闭环**
   - 列表栏（`WorkBuddyListHeader.tsx` + `WorkBuddyListPane.tsx` + `WorkBuddyMailCard.tsx`）：复用 `.list-header`，支持绿色轻量配额胶囊（`配额 46/50`）、旋转刷新按钮、可折叠搜索框（并与全局 `TopBar.tsx` 搜索框双向联动）、2 栏滑动 `.filter-tabs`（`收件箱` | `已发送`）、分组元信息行（`最近邮件 · 同步于 HH:mm` + `1–N / N`）以及带绿色 `WorkBuddy` `.source-tag` 的标准邮件卡片。
   - 阅读器（`WorkBuddyReaderPane.tsx` + `WorkBuddyReaderChrome.tsx` + `WorkBuddyThreadCard.tsx`）：复用 `.reader-toolbar`（标为已读/已读柔和绿勾、复制发件人、刷新正文、下载附件、竖向分隔线 + 轻红删除按钮 + 右侧 `1 / N` 上下封切换）、`.reader-badges-row`、大号主题、首字母头像会话卡片（`20px 24px` 舒适内边距包裹 `SafeMailHtmlView` 或纯文本及附件列表），以及固定底栏（同步状态 + 复制邮箱地址 +「用常规邮箱写信回复」自动打开 `ComposeModal` 预填 `to` 与 `Re: <原主题>`）。

## 验证结果

- 单文件行数检查：全部修改与新增源码文件均严格 `<= 200` 行。
- 单元测试：新增 `tests/agent-mail-format.test.mjs` 并更新 `tests/workbuddy-mail.test.mjs`，前端 102 项单测全部通过。
- 构建与全量门禁：`pnpm run typecheck`、`pnpm run build`、`task verify` 与 `task build` 全部通过。
