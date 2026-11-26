# TASK-20261126-012 · 修复后台同步或单账户同步后顶栏胶囊卡死「正在同步…」与手动刷新锁死

- 状态：Completed
- 实现提交：未提交（待用户确认后提交）
- 范围：
  1. 解耦「前端主动发起的手动同步期（`manualSyncPending`）」与「真实账户运行态（`syncingAccounts.length > 0`）」，消除 `syncLabel === "正在同步…"` 导致的单向卡死；
  2. 修复 `useDesktopBridge.ts` 中 `onAccountStatus` / `onSyncProgress` 仅处理 `=== "syncing"` 单边分支的问题，并在 `onSyncProgress` 收到终态时推进残留乐观 `syncing` 账户与触发校准；
  3. 修复 `useAppActions.ts` 中 `triggerSyncAll` / `triggerSyncAccount` 的 `manualSyncPending` 释放、真实防重入判断及 `.catch()` 账户状态恢复；
  4. 确保 `TopBarSyncChip.tsx` 与 `syncChipModel.ts` 在同步结束后平滑播放约 1s 的绿色 `done`（「全部已同步」）收尾动效并回归 `healthy`（「所有邮箱已同步」），补充 `tests/account-sync-state.test.mjs` 回归单测。

## 关键实现

- **同步状态收敛解耦（`accountSyncState.ts` + `useWorkspaceStore.ts` + `useWorkspaceTheme.ts`）**：
  - `reconcileRuntimeSyncState` 增加 `manualSyncPending?: boolean`：当 `accounts.length > 0 && syncingAccounts.length === 0 && !manualSyncPending` 时，无条件将残留的同步中文案收敛为 `topbar.allAccountsSynced` 或 `topbar.syncPartialFailed`；
  - 新增 `canTriggerManualSync`、`resolveIdleSyncLabel` 与 `applySyncProgressToAccounts`；
  - `useWorkspaceStore.ts` 维护 `manualSyncPending` 计数并在 `refreshProfilesAndAccounts` 落盘校准时同步清理底层 `syncLabel`。
- **事件桥接与手动同步收尾（`useDesktopBridge.ts` + `useDesktopStorageOps.ts` + `useAppActions.ts` + `AppContext.tsx`）**：
  - `onAccountStatus` 与 `onSyncProgress` 双边处理：当 `st !== "syncing"` / `p.status !== "syncing"` 且所有账户均离开 `syncing` 且 `!manualSyncPending` 时立即将 `syncLabel` 归位；若 `onSyncProgress` 收到 `done` / `failed` / `partial` 而账户仍停留在乐观 `syncing`，立即推进状态并异步调用 `refreshProfilesAndAccounts` 校准；
  - `triggerSyncAll` 使用 `canTriggerManualSync` 判断防重入并在 `.finally()` 中释放 `manualSyncPending`；`triggerSyncAccount` 同样在 `.finally()` 释放 `manualSyncPending`，并在 `.catch()` 中将乐观 `syncing` 恢复为 `error` 避免卡死。
- **顶栏胶囊与收尾过渡（`syncChipModel.ts` + `TopBarSyncChip.tsx`）**：
  - `activelySyncing` 改为严格基于 `Boolean(manualSyncPending) || derived.syncingAccounts.length > 0`；全部同步结束后平滑触发 1050ms `done`（「全部已同步」）绿色勾选态，随后回到 `healthy`（「所有邮箱已同步」）并恢复点击 / `Ctrl+R` 刷新。

## 实际验证

- 单文件行数门禁：所有新增与修改的前端手写文件均严格 `<= 200` 行；
- `pnpm --dir desktop/frontend test`：117 项前端单元测试全部通过（含新增 `tests/account-sync-state.test.mjs` 的后台同步闭环、部分失败收敛及 `manualSyncPending` 进行中保护与 `sync:progress` 终态推进测试）；
- `task verify`（含 `typecheck`、`lint`、`test`、`build`、`go vet`、`go test ./...`、`go build`）：零错误通过。
