# TASK-20261125-009 部分账户同步受阻 · 顶部状态胶囊、轻量浮层与瞬时断连重试

- **状态**：Completed
- **创建日期**：2026-11-25
- **完成日期**：2026-11-25

## 原始需求与范围

对照 OpenPencil 设计规范 `OmniMail-redesign.fig` -> `08 · 空白与异常状态` -> `部分账户同步受阻 · 顶部状态胶囊与浮层规范（亮 / 暗双色）`（Node ID: `1859607977:3079`），完成三项修复与 UI 升级：

1. **Go 后端优化（IMAP 建连瞬时断连静默退避重试 + 透传真实阶段错误摘要）**：
   - `desktop/internal/syncer/`：在 `runOneSyncCycle()` 调用 `ConnectIMAP` 建连阶段遇到瞬时网络错误（`io.ErrUnexpectedEOF`、`io.EOF`、`use of closed network connection`、`connection reset`、`i/o timeout` 等，排除 `apperr.CodeAuthExpired` 与 `ctx.Canceled`）时，在标记账户 `error` 之前自动执行 **2 次静默短退避重试**（`1.5s`、`3s` + jitter，响应 `w.ctx.Done()`）；重试成功则不报任何错误，连续重试仍失败才上报真实阶段原因（如 `连接收件服务器失败（IMAP 993）：unexpected EOF`）并写入 `sync_logs`。
   - `desktop/internal/accounts/` & `desktop/internal/events/`：确保 `EmailAccountDTO` 与 `AccountStatusPayload` 均携带 `lastError` 字段，且 `status == "connected"` 时强制置空 `""`。
2. **前端核心 Bug 修复（禁止 `accounts[0]` 背锅 + 自动恢复归绿清零 + 移除局部通栏黄条）**：
   - 彻底清除 `StatusBanner.tsx`、`DiagnosticsModal.tsx`、`AccountServerModal.tsx` 中的 `accounts.find(...) ?? accounts[0]` 兜底。
   - 异常账户严格按实时状态派生（`errorAccounts` / `authExpiredAccounts`）。
   - `useDesktopBridge.ts` 同步更新 `lastError`（`connected` 时清空 `""`），`useWorkspaceStore.ts` 在渲染期纯函数收敛状态，所有账户恢复正常时自动清空残留 `partial-sync` / `auth-expired` 状态并将顶栏胶囊恢复为绿色 `所有邮箱已同步`。
   - `StatusBanner.tsx` 移除 `partial-sync` 与局部账号通栏条，仅保留全局 `offline` 与 `auto-reply`，零工作区推挤。
3. **UI 升级（对齐 OpenPencil `1859607977:3079` 亮 / 暗双色）**：
   - `TopBarSyncChip.tsx`：存在异常账户时切换为柔和琥珀色（`{count} 个邮箱同步受阻`）或柔和红色（`{count} 个邮箱需重新授权`）胶囊并附向下小箭头，点击展开/收起 `SyncStatusPopover`。
   - 新增 `SyncStatusPopover.tsx`、`SyncIssueAccountCard.tsx` 与配套样式表：Portal 锚定于顶栏胶囊下方，展示异常计数胶囊、`全部重试`、真实异常账户卡片（`ProviderIcon`、邮箱与时间、状态胶囊、`lastError` 原因框、`运行连接诊断` / `立即重试` / `重新授权`）与底部 `其余 {n} 个邮箱同步正常` 汇总条。
   - `SidebarAccountSection.tsx` & `sidebar-account-row.css`：仅对真实 `error` / `auth-expired` 账户行高亮柔和琥珀/红边框底色，并在右侧状态位展示紧凑 `诊断` / `重连` 胶囊，阻止冒泡直达目标账户诊断或重连。

## 落地变更摘要

- **Go 后端**：
  - [worker_connect.go](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/internal/syncer/worker_connect.go) & [worker.go](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/internal/syncer/worker.go)：封装 `connectWithTransientRetry`、`isTransientConnectError`、`classifyConnectStatus` 与 `formatStageLastError`。
  - [types.go](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/internal/accounts/types.go)、[repo.go](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/internal/accounts/repo.go) & [repo_write.go](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/internal/accounts/repo_write.go)：稳定输出 `lastError`，并在 `connected` 时强制清空。
  - [worker_connect_retry_test.go](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/internal/syncer/worker_connect_retry_test.go)：覆盖首次 `unexpected EOF` 静默重试成功、连续 3 次失败上报 `error` 与真实错误摘要、`CodeAuthExpired` 不重试直接上报 `auth-expired`。
- **前端状态、UI 与双语词典**：
  - [accountSyncState.ts](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/state/accountSyncState.ts) & [syncChipModel.ts](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/state/syncChipModel.ts)：纯函数派生异常账户、状态补丁、恢复自动清零与顶栏胶囊模型。
  - [useDesktopBridge.ts](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/state/useDesktopBridge.ts)、[useWorkspaceStore.ts](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/state/useWorkspaceStore.ts)、[useAppActions.ts](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/state/useAppActions.ts)、[StatusBanner.tsx](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/components/shell/StatusBanner.tsx)、[DiagnosticsModal.tsx](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/components/overlays/DiagnosticsModal.tsx) & [AccountServerModal.tsx](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/components/overlays/AccountServerModal.tsx)：彻底清除 `accounts[0]` 兜底与 `partial-sync` 通栏黄条，新增单账户 `triggerSyncAccount`。
  - [TopBarSyncChip.tsx](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/components/shell/TopBarSyncChip.tsx)、[SyncStatusPopover.tsx](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/components/shell/SyncStatusPopover.tsx)、[SyncIssueAccountCard.tsx](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/components/shell/SyncIssueAccountCard.tsx)、[SidebarAccountSection.tsx](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/components/shell/SidebarAccountSection.tsx) & [SidebarAccountsAndLabels.tsx](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/components/shell/SidebarAccountsAndLabels.tsx)：落地顶栏胶囊、同步浮层与侧栏单账号原位提示。
  - [syncStatus.ts (zh)](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/i18n/zh/syncStatus.ts)、[syncStatus.ts (en)](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/i18n/en/syncStatus.ts)、[sync-status-popover.css](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/styles/sync-status-popover.css)、[sync-status-popover-cards.css](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/styles/sync-status-popover-cards.css)、[sync-status-popover-healthy.css](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/styles/sync-status-popover-healthy.css) & [sidebar-account-row.css](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/styles/sidebar-account-row.css)。
  - [sync-status-popover.test.mjs](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/tests/sync-status-popover.test.mjs)：覆盖 Yandex 单独报错零误伤网易邮箱、`connected` 自动归绿与 `StatusBanner` 零 `partial-sync` 通栏渲染断言。

## 验证结果

- `task format` 与全仓手写源码 `<= 200` 行检查：通过。
- `go test ./...`：全包通过（含新增 `TestConnectTransientEOFRetriesSilentlyAndSucceeds`、`TestConnectExhaustsTwoRetriesThenReportsRealError`、`TestConnectAuthExpiredDoesNotRetry`）。
- 前端单测（`npm test`）：95 / 95 全部通过。
- `npm run build` 与 `task verify`（Wails bindings、`eslint`、`tsc --noEmit`、`vite build`、`go vet`、`go test`、`go build`）：全部零错误通过。
