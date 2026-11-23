# 测试与质量门

| 命令 | 用途 |
| --- | --- |
| `task test` | 生成最新 Wails 绑定和前端产物，运行全量纯 Go 单元测试（`go test ./...`） |
| `task verify` | 安装锁定依赖、检查 Go 与前端格式、运行 ESLint / TypeScript / Vite 构建、`go vet`、全量 Go 测试与开发构建 |

## 自动化测试覆盖

- **纯 Go 单元测试（离线可重复执行）**：覆盖桌面引导与双轨版本号解析（`desktop`）、DPAPI 凭据盒与 Argon2id PIN 锁及 HTML 净化（`internal/security`）、SQLite WAL 16 表与 Zstd CAS 存储（`internal/storage`、`internal/profilemgr`）、10 家服务商解析与 CJK 解码及 `.ics` 冲突检测（`internal/mailproto`、`internal/oauth`）、幂等同步与 FTS5 混合检索（`internal/syncer`）、RFC5322 BCC 零头泄露与零网络真撤回（`internal/outbox`）、联系人/黑名单/规则干跑/防循环自动回复（`internal/contacts`、`internal/rules`）、5 步 `PrivacyGuard` 与脱敏诊断包（`internal/ai`、`internal/diagnostics`）。
- **可选真实邮局非破坏性协议验证（`//go:build live`）**：在配置本地临时环境变量 `OMNIMAIL_LIVE_ACCOUNTS_FILE` 时，可在 `desktop/` 下执行 `go test -tags=live ./internal/syncer ./internal/outbox` 进行只读 `BODY.PEEK[]` 多邮局连通验证（严禁在仓库内写入任何真实账号或凭据）。

## 桌面窗口手工冒烟

涉及原生窗口、系统托盘、本地空间切换或 WebView2 动效时，可执行 `task dev`（或 `task build` 后运行 `task run`）核验冷启动开屏、三断点响应式布局、亮/暗主题扩散切换与 4 步连接探测握手反馈。
