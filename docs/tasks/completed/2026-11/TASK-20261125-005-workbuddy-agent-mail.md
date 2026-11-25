# TASK-20261125-005 腾讯 WorkBuddy Agent 邮箱原生接入

- **状态**：Completed
- **创建日期**：2026-11-25
- **完成日期**：2026-11-25
- **实现提交**：`d0bce87c9ef545430392e945c8e345016b923748`（`codex/reader-toolbar-overlap`）

## 原始需求与范围

对照 `OmniMail-WorkBuddy-AgentMail-接入方案.md` 与 `OmniMail-redesign.fig`（`09 · 邮箱接入指引` → `WorkBuddy Agent 邮箱 · 浏览器授权接入 · 亮色 / 暗色`），在 OmniMail 桌面端原生接入腾讯 WorkBuddy Agent 邮箱，零外部进程依赖、遵守手写源码 `<= 200` 行上限与双语国际化规范。

## 实际改动

1. **Go 原生后端（`desktop/internal/workbuddymail/`）**：
   - 新增 `types.go`、`auth_helpers.go`、`auth.go`、`auth_session.go`、`client.go`、`mail_api.go`、`mail_list.go`、`mail_mutations.go`、`normalize.go`、`vault_store.go`、`manager.go`、`manager_connect.go`、`manager_ops.go`、`manager_helpers.go`。
   - 基于标准库 `net/http` + `context.Context` 实现 `StartBrowserAuth`、`PollAuthToken`、`FetchAccountInfo`、`RefreshToken`（并发单飞单次 `401` 刷新并写回加密 Vault）、`Logout`、`GetConnectorStatus`、`GetMeAndAliases`、`ListMessages`、`SearchMessages`、`GetMessageDetail`（`bluemonday` 净化）、`MarkAsRead`、两步 `confirmation_token` `DeleteMessage` 与 25MB 有界流式 Base64 解码 `DownloadAttachment`。
2. **Wails 服务与主程序注册**：
   - 新增 `desktop/services/workbuddy_mail_service.go` 并在 `desktop/main.go` 注册 `WorkBuddyMailService` 与会话钩子，重新生成 TypeScript 绑定；所有凭据按 `workspace_id + account_id` 存储于 DPAPI `secrets.vault`，与常规 IMAP `accounts` 表和 SMTP 写信发件箱完全隔离。
3. **前端品牌图标、双栏弹窗与阅读视图**：
   - 将 `Square150x150Logo.png` 高质量缩放为 `128×128` 保存到 `desktop/frontend/src/assets/providers/workbuddy.png`，注册 `ProviderIcon`。
   - 新增 `WorkBuddyConnectModal.tsx` / `WorkBuddyConnectForm.tsx`（`980×760` 双栏结构，无任何实验性/Beta/私有协议/安全边界告警文案）、`WorkBuddyMailView.tsx` / `WorkBuddyListPane.tsx` / `WorkBuddyReaderPane.tsx` / `WorkBuddyReaderExtras.tsx`、`SidebarWorkBuddySection.tsx`、`WorkBuddyAccountsSection.tsx`、`useWorkBuddyStore.ts` 及中英双语词典 `i18n/{zh,en}/workBuddy.ts`。
4. **测试与文档同步**：
   - 新增 `desktop/internal/workbuddymail/auth_client_test.go`、`mail_api_test.go` 与 `desktop/frontend/tests/workbuddy-mail.test.mjs`。
   - 更新 `docs/product/PRD.md`、`docs/architecture/OVERVIEW.md`、`docs/plans/CURRENT.md`。

## 验证结果

- `go test ./...`：全部 Go 包测试通过（含 `omnimail/internal/workbuddymail` 离线 `httptest.NewServer` 测试）。
- `npm run build` & `npm test`：TypeScript 类型检查、Vite 构建及 86 项前端单元测试全部通过。
- `task verify`：`eslint`、格式校验、`go vet`、全量前后端单测与 `bin/omnimail.exe` 构建全部通过；全仓手写源码文件均 `<= 200` 行。

## 未验证事项

- 未对公网真实 WorkBuddy 线上账号发起浏览器登录实测（由离线 `httptest.NewServer` 完整覆盖协议交互与异常分支）。
