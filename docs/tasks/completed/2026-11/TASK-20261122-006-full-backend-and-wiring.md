# TASK-20261122-006：OmniMail 全量 Go 后端实现、前后端真实联调与多邮局协议验证

## 状态
Completed

## 原始需求
独立、端到端完成 OmniMail 桌面端（Wails v3.1.0 + Go 1.26 + React 19 + TypeScript 5.9，Windows x64）的全部 4 阶段 Go 后端开发、前后端 40 项功能与 27 个弹窗/10 个设置页签真实接线，以及本机外部测试账号的非破坏性协议连通验证。

## 完成内容摘要
1. **Phase 1（本地多空间 + SQLite WAL + DPAPI + 10 家服务商接入）**：落地 `internal/config`、`internal/storage`、`internal/security`、`internal/mailproto/providers`、`internal/oauth`、`internal/profilemgr`、`internal/accounts` 与 `ProfileService`、`AccountService`、`DesktopService` 升级。
2. **Phase 2（双连接 IMAP 同步 + CJK MIME + HTML 净化 + FTS5 全文搜索）**：落地 `internal/mailproto`（Special-Use、多字符集解码、3 级会话归并）、`internal/security/html_sanitizer.go`、`internal/syncer`（双连接 Worker、24m IDLE、指数退避、`imap_op_queue`、Snooze 唤醒、LRU 附件回收）、`internal/search`、`MailService` 及 `/omnimail-cid/` 受控本地媒体流。
3. **Phase 3（身份锁定写信 + 自动草稿 + 持久化发件状态机）**：落地 `internal/mailproto/mime_builder.go`（BCC 严格仅入 SMTP 信封）与 `internal/outbox`（`undo_pending` 零网络真撤回、`scheduled` 跨重启定时、退避重试、Sent 去重）及 `ComposeService`。
4. **Phase 4（通讯录/黑名单/规则/休假回复/ICS + AI 隐私网关 + 安全诊断与桌面收口）**：落地 `internal/contacts`、`internal/rules`、`internal/mailproto/ics_parser.go`、`internal/ai`（5 步 `PrivacyGuard` + 多模型 SSE + `ai_insights` 缓存）、`internal/security/phishing.go`、`internal/diagnostics` 以及 `ContactService`、`RuleService`、`AiService`、`DiagnosticService` 全量前后端联调。

## 验收与验证结果
- `task verify`（含 `wails3 generate bindings`、`gofmt`、`go vet ./...`、`go test ./...`、Prettier、ESLint、`tsc --noEmit`、`vite build`）全部 0 错误通过；
- `task build` 生成开发二进制 `desktop/bin/OmniMail.exe`（纯 Go `CGO_ENABLED=0`）；
- 全仓库手写源码文件严格控制在 `<= 200` 行以内，零 `TODO`、零外部测试账号/密码残留；
- `go test -tags=live`：7/7 家真实邮局（Gmail、163、LinuxDo、Yandex、Naver、Yahoo、iCloud）只读连通与拉取建索全部通过，单封 Gmail 自发自收闭环冒烟测试通过。
- **未验证事项**：企业级自建 Exchange/Kerberos 环境及超大单库（十万级以上邮件）长周期压测留待后续迭代专项验证。
- **关联文档**：[后端全量实现报告](../../../BACKEND_IMPLEMENTATION_REPORT.md)、[ADR-002](../../../decisions/ADR-002-local-first-mail-backend.md)、[架构概览](../../../architecture/OVERVIEW.md)、[技术栈](../../../architecture/TECH_STACK.md)、[测试与质量门](../../../development/TESTING.md)、[产品范围](../../../product/PRD.md)、[当前状态](../../../plans/CURRENT.md)。
- **Git 提交**：实现提交 `3cbd1bd`、`4697c40`。
