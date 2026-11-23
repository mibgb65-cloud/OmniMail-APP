# 技术栈

| 层 | 当前选型 |
| --- | --- |
| 桌面壳与运行时 | Go 1.26（`CGO_ENABLED=0` 纯 Go 零 CGO），Wails v3.1.0，Windows WebView2 |
| 本地存储与加密 | `modernc.org/sqlite`（WAL + 外键 + FTS5 `trigram`），`klauspost/compress/zstd` CAS 归档，Windows DPAPI（`x/sys/windows`）凭据盒，`argon2id` PIN 锁 |
| 邮件与日程协议 | `emersion/go-imap/v2`、`go-smtp`、`go-sasl`、`go-message`（含 `x/text` 多字符集解码）、`go-ical`、`microcosm-cc/bluemonday` HTML 净化、`x/oauth2` + `x/sync/singleflight` |
| 前端 | React 19、TypeScript 5.9、Vite 8、Shadow DOM 安全阅读隔离、普通模块化 CSS |
| 工具与验证 | Node.js 22.19.0、pnpm 12.6.0、Task 3.53.1、`gofmt`、`go vet`、`go test`、Prettier、ESLint、TypeScript |

精确依赖以 [desktop/go.mod](../../desktop/go.mod)、[desktop/frontend/package.json](../../desktop/frontend/package.json) 及锁文件为准（选型决策见 [ADR-002](../decisions/ADR-002-local-first-mail-backend.md)）。升级 Wails 时同步检查 Go 模块、CLI 和 `@wailsio/runtime`，重新生成绑定并跑 `task verify`。
