# TASK-20261125-011 修复 WorkBuddy Agent 邮箱已开通账号误判未绑定与边界容错

- **状态**：Completed
- **创建日期**：2026-11-25
- **完成日期**：2026-11-25
- **实现提交**：`48f2c0efc57a3ebb4235195987796d67a0c21c11`（`codex/reader-toolbar-overlap`）

## 原始需求与范围

修复腾讯 WorkBuddy Agent 邮箱在 `/v2/as/connector/agentmail/me` 返回 `"status": "active"` 时被 `NormalizeMailboxStatus` 兜底误判为 `StatusNotBound` 的核心缺陷，并加固连接器错误处理、时间解析、账号轮询与官方域名白名单：

1. **状态枚举归一化修复**：
   - `desktop/internal/workbuddymail/normalize.go`：`NormalizeMailboxStatus` 支持 `"active"`（兼容 `"running"`）统一归一化为 `StatusRunning`；`"forbidden"` 继续映射为 `StatusBanned`。
   - `desktop/frontend/src/services/workBuddyMappers.ts`：`mapMailboxStatus` 同步兼容 `"active"` -> `"running"` 与 `"forbidden"` -> `"banned"`。
2. **`GetConnectorStatus` 错误透传与 `openedAt` 多态时间解析**：
   - `desktop/internal/workbuddymail/mail_api.go`：`status >= 400`（非 401/403）或 `code != 0`（非明确未绑定）均返回 `CodeWBGatewayFailed`（附去敏状态码/原因），不再静默伪装成 `StatusNotBound`；`raw.OpenedAt` 改为 `json.RawMessage` 并兼容秒/毫秒时间戳与 ISO 时间字符串。
3. **`FetchAccountInfo` 轮询、官方域名白名单、`X-Product` 头与 `mapRestError` 404 信息保留**：
   - `desktop/internal/workbuddymail/auth_session.go` & `auth.go`：`FetchAccountInfo` 遇 `code == 12151` 按 `a.pollInterval`（受 `ctx` 控制）持续轮询重试，认证请求统一携带 `X-Product: SaaS`。
   - `desktop/internal/workbuddymail/auth_helpers.go`：`allowedAPIDomains` 补齐 `www.codebuddy.cn` 与 `wb.tencentbuddy.com`，`isTrustedAuthHost` 同步放行 `codebuddy.cn` 与 `tencentbuddy.com`。
   - `desktop/internal/workbuddymail/normalize.go`：`mapRestError` 在 `404` / `NOT_FOUND` 时优先展示去敏截断后的 `env.Error.Message`。
   - `desktop/internal/workbuddymail/mail_api.go` & `manager_ops.go`：`GetMeAndAliases` 过滤未绑定无效别名并优先匹配 `preferredEmail`。

## 落地变更摘要

- `desktop/internal/workbuddymail/normalize.go` & `normalize_helpers.go`：修复 `"active"` -> `StatusRunning` 归一化，保留可读 `404` / `NOT_FOUND` 消息并拆分地址/多态时间解析辅助函数（均 `<= 200` 行）。
- `desktop/internal/workbuddymail/mail_api.go` & `manager_ops.go`：加固 `GetConnectorStatus` 非 0 业务码 / `status >= 400` 报错与 `openedAt` 多态解析，优化 `GetMeAndAliases` 别名筛选与匹配。
- `desktop/internal/workbuddymail/auth.go`、`auth_session.go` & `auth_helpers.go`：补齐 `X-Product: SaaS` 请求头、`12151` 按 `pollInterval` 持续轮询重试及 `www.codebuddy.cn` / `wb.tencentbuddy.com` 域名白名单。
- `desktop/frontend/src/services/workBuddyMappers.ts`：兼容 `"active"` -> `"running"` 与 `"forbidden"` -> `"banned"`。
- `desktop/internal/workbuddymail/workbuddy_regression_test.go` & `desktop/frontend/tests/workbuddy-mail.test.mjs`：覆盖 `"active"` 实测响应端到端 `runAuthPollLoop` 进 `AuthStageAuthorized` 并命中 `pifz6658@agent.qq.com`、保留 `"running"` 兼容、非 0 业务码不伪装 `not_bound`、`12151` 多次轮询成功、ISO `openedAt`、404 自定义错误消息与前端 `mapMailboxStatus("active") === "running"` 断言。

## 验证结果

- `task format` 与全仓手写源码单文件 `<= 200` 行检查：通过。
- `go test -v ./internal/workbuddymail/...`：全部通过。
- `task verify`（Wails bindings、`eslint`、`tsc --noEmit`、`vite build`、前端 95/95 单元测试、`go vet`、`go test ./...`、`go build`）：全部零错误通过。
