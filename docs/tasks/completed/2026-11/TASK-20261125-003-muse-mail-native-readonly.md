# TASK-20261125-003：Meta Muse Mail（`@muse.ai`）独立网页登录与 Go 原生只读接入

- **状态**：Completed
- **日期**：2026-11-25
- **关联文档**：
  - [产品范围](../../../product/PRD.md)
  - [架构概览](../../../architecture/OVERVIEW.md)
  - [技术栈](../../../architecture/TECH_STACK.md)
  - [当前状态](../../../plans/CURRENT.md)

## 1. 原始需求与范围

在零外部 Python / `muse-cli` 运行时依赖、与现有 IMAP/OAuth/SQLite/CAS/AI 体系彻底解耦的前提下，实现 Meta Muse Mail（`@muse.ai`）独立隔离 WebView2 官方网页登录、Go 原生加密 WSS 只读网关接入、双栏高保真连接弹窗（`MuseConnectModal`）与独立只读会话视图（`MuseMailView`）。

## 2. 实际改动

### 2.1 Go 原生后端与独立登录宿主
- **独立隔离 WebView2 登录宿主**（`desktop/internal/musemail/login_win32_windows.go`、`login_host_windows.go`、`login_callbacks_windows.go`、`webview_vtbl_windows.go`、`webview_com_windows.go`、`login_nav_guard.go`、`login_host_stub.go`）：
  - 使用独立 STA OS 线程、独占临时用户数据目录（`0o700`）与原生 Win32 窗口承载 WebView2，不复用共享全局 `WebviewUserDataPath` 的普通 Wails 窗口；
  - 禁用 `AreHostObjectsAllowed`、`IsWebMessageEnabled`、`AreDevToolsEnabled`、默认右键菜单与状态栏，顶层导航与 `NewWindowRequested` 均经固定 HTTPS 官方认证域白名单校验；
  - 仅在用户主动点击「打开 Muse 登录窗口」后启动，并在验证连接时仅提取 `muse.ai` / `.muse.ai` 域最小会话（要求非空未过期 `hatch_sess`），关闭/取消/断开/退出时清空 Cookie 并重试移除临时目录。
- **Go 原生会话换票、Noise XX + Protobuf 分帧网关与内存态管理**（`auth_exchange.go`、`tls_transport.go`、`proto_wire.go`、`proto_envelope.go`、`proto_messages.go`、`gateway_client.go`、`gateway_read.go`、`gateway_framing.go`、`normalize*.go`、`manager*.go`）：
  - 基于 `utls`（严格校验证书与主机名、禁自动重定向）、`coder/websocket`、`flynn/noise`（`Noise_XX_25519_AESGCM_SHA256`）与 `protowire` 实现只读白名单路由（`email.mailbox.get`、`email.threads.list`、`email.threads.get`）；
  - 同连接核验 `@muse.ai` 身份，重连检测到身份变更立即清屏阻断（`ERR_MUSE_IDENTITY_CHANGED`）；单连接串行请求，单帧（`128 KiB`）、分片组（最多 4 组 / 每组 64 片）与累计响应体（`4 MiB`）边读边限；游标绑定 `(profileID, connID, refreshEpoch)` 并支持去重与循环游标终止；实现 `profilemgr.SessionHook`，切空间或锁屏即时取消在途请求并销毁内存会话。
- **Wails 窄接口服务**：新增 `desktop/services/muse_mail_service.go` 并在 `desktop/main.go` 注册为第 10 个 Service，生成强类型绑定 `musemailservice.ts`。

### 2.2 前端品牌资源、双栏接入弹窗与只读会话视图
- **官方品牌资源**：新增 `desktop/frontend/src/assets/providers/muse.svg`（Meta Blue `#0064E0` Squiggle）并在 `ProviderIcon.tsx` 注册 `muse`，保持 `PROVIDER_CATALOG` 9 家标准 IMAP/OAuth 预设零污染。
- **双栏接入弹窗**：`AddAccountModal.tsx` 新增 Muse Mail 入口卡，打开 `MuseConnectModal.tsx` + `MuseConnectForm.tsx`（复用 `ProviderConnectShell` 与 `PreparationGuideCard`，严格对齐亮暗双色令牌且不含任何「实验性」或「非官方接口 / 安全边界」警示词）。
- **独立侧边栏小节、设置断开入口与只读视图**：新增 `SidebarMuseSection.tsx`（无伪造未读数与同步圆点）、`AccountsTab.tsx` 独立会话断开卡、`useMuseMailStore.ts`（+ `museStoreHelpers.ts`），以及 `components/muse/`（`MuseMailView.tsx`、`MuseThreadListPane.tsx`、`MuseThreadReaderPane.tsx`、`MuseStateCard.tsx`）与 `styles/muse-mail*.css`、`i18n/{zh,en}/museMail.ts`，完整覆盖 6 类状态、入站/出站标记、`时间未知` 兜底、服务端 `created_at` 说明、中性 `Muse 提供` 认证标签及只读附件元数据。

## 3. 验证结果

- **Go 离线单元测试**：`go test -v ./internal/musemail/...` 及全仓 `go test ./...` 全部通过（伪网关覆盖 Noise XX 握手、正常帧、乱序分片重组、不完整分片断线、累计响应超限、请求超时、`403 email_not_enabled` 映射与错误脱敏、重连身份变更阻断清屏、游标去重与循环终止、未加载会话越权拦截、切空间丢弃迟到响应、登录 URL 白名单与最小 Cookie 过滤）。
- **前端单测与静态检查**：新增 `desktop/frontend/tests/muse-mail.test.mjs`，`npm run typecheck` 与 `npm test`（83/83 全部通过）；全仓手写源码单文件均 `<= 200` 行。
- **全量验证门禁**：`task bindings` 与 `task verify`（`gofmt`、Prettier、ESLint、TypeScript、Vite 构建、前端单测、`go vet`、`go test ./...`、`go build`）零警告零错误通过。

## 4. 尚未验证事项

- 真实 `@muse.ai` 账号在 Windows 桌面端打开独立 WebView2 官方登录页、二次验证及线上网关首屏联调需由账号持有人在安装新版 Beta 包后人工实测验证。
