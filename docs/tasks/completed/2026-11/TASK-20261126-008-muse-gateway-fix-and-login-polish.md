# TASK-20261126-008 · 修复 Muse Mail 网关通信异常、WebView2 登录窗口沉浸式美化与自动闭环

- 状态：Completed
- 实现提交：未提交（按协作规则，未明确要求不创建 Git 提交）
- 范围：
  1. 修复 `ERR_MUSE_GATEWAY_FAILED` 三项根因：uTLS ALPN 限定 `http/1.1`（并剥离 `h2` ALPS 扩展与握手后协议校验）、环境变量 + Windows WinINet 注册表系统代理（HTTP `CONNECT` / `SOCKS5`）隧道拨号、全阶段脱敏诊断信息（`[session]`、`[auth_check]`、`[hatch_token]`、`[ws_dial]`、`[noise_xx]`、`[mailbox_get]` 等）；
  2. 对齐 OpenPencil `31 · 智能体邮箱统一主界面规范`（`261906429:37`、`261906429:159`），基于纯 Win32 + DWM + GDI + WebView2 实现独立登录窗口沉浸式暗色标题栏与圆角、深色无白闪画刷、`ICoreWebView2Controller2.PutDefaultBackgroundColor`、EXE 内嵌图标加载与移除最大化按钮、DPI 感知 `480×680`（最小 `420×580`）与主窗居中偏左不遮挡定位、顶部 `30px` 原生 GDI 安全信任条与 WebView2 `Bounds` 偏移；
  3. 新增轻量 `CheckLoginSessionReady()` 本地 Cookie 探测接口与前端 `MuseConnectModal` `1500ms` 温和轮询，检测到有效 `hatch_sess` 后单飞自动触发一次 `VerifyConnection()`，核验成功后自动关闭独立登录窗、回填真实 `@muse.ai` 地址与默认账户名 `Muse`，切换至一键确认接入状态。

## 实际改动

- **uTLS `http/1.1` ALPN 与系统代理隧道**：
  - `desktop/internal/musemail/{tls_transport,gateway_client,proxy_resolve,proxy_resolve_windows,proxy_resolve_other,proxy_tunnel}.go`：`HTTPClient` 与 `WSDialHTTP` 统一显式使用 `[]string{"http/1.1"}`，空 `alpnProtos` 默认回退 `http/1.1`，禁用 `h2` 时移除 Chrome ALPS 扩展并在握手后校验 `NegotiatedProtocol`；优先解析 `HTTPS_PROXY`/`HTTP_PROXY`/`ALL_PROXY`/`NO_PROXY`，回退读取 Windows 注册表 `Internet Settings`（兼容纯 `host:port`、`http=...;https=...`、`socks=...` 与 `ProxyOverride` 绕过），支持 HTTP(S) `CONNECT`（含 Basic 鉴权）与 `SOCKS5` 隧道后套 `uTLS` Chrome 握手。
- **阶段脱敏诊断信息**：
  - `desktop/internal/musemail/{errors,auth_exchange,gateway_read,gateway_framing}.go` 与 `desktop/frontend/src/services/errorParser.ts`：保持前端错误码常量不变，保留脱敏阶段标签与状态码/错误分类，严禁泄露任何 Cookie、Token、URL 查询参数或原始响应体。
- **独立 WebView2 登录窗口沉浸式美化**：
  - `desktop/internal/musemail/{login_win32_windows,login_dwm_windows,login_icon_windows,login_ribbon_windows,login_monitor_windows,login_layout,login_callbacks_windows,login_host_windows,login_teardown_windows,webview_vtbl_windows,webview_com_windows,app_icon}.go` 与 `desktop/main.go`：首帧显示前设置 DWM 暗色属性（`20` 回退 `19`、`33` 圆角、`35` `#16181C`、`36` `#E2E8F0`）、`#1E1F22` 深色窗口画刷与 `ICoreWebView2Controller2.PutDefaultBackgroundColor`、EXE 模块/内嵌 ICO 图标、移除 `WS_MAXIMIZEBOX`、DPI 感知 `480×680` 智能偏左夹紧定位，并在客户区顶部双缓冲绘制 `30px` 原生安全信任条。
- **登录会话自动检测、自动核验与自动关窗闭环**：
  - `desktop/internal/musemail/{types,manager,manager_connect,manager_probe}.go`、`desktop/services/muse_mail_service.go`、`desktop/frontend/src/services/museMailApi.ts`、`desktop/frontend/src/components/onboarding/{MuseConnectModal.tsx,museConnectPolling.ts,useMuseLoginAutoFlow.ts}`：新增无外部网络请求的 `CheckLoginSessionReady()`，前端每 `1500ms` 防重入轮询，就绪后单次自动触发 `VerifyConnection()`（失败自动停止轮询保留手动重试），成功后自动关窗并默认回填账户名 `Muse`。
- **单元测试与文档**：
  - 新增/更新 `desktop/internal/musemail/{proxy_tls_test,login_and_diag_test,webview_vtbl_windows_test}.go` 与 `desktop/frontend/tests/muse-connect-flow.test.mjs`；同步更新 `docs/architecture/OVERVIEW.md`、`docs/plans/CURRENT.md`、`docs/development/TESTING.md`。

## 验证结果

- `go test -v ./internal/musemail/...`：14 项测试（含 ALPN 限定与 ALPS 剥离、环境变量与注册表代理规则、本地 mock HTTP `CONNECT` 鉴权隧道、阶段脱敏不泄露敏感凭据、DWM 失败安全降级、信任条 `Bounds` 与智能偏左定位、`CheckLoginSessionReady` 零外部请求与自动关窗、Windows 实机隔离 WebView2 启动与 Cookie 提取）全部通过。
- 全量 `task verify`：Wails 绑定、`gofmt`、Prettier、ESLint、`tsc --noEmit`、Vite 构建、前端 111 项单测、`go vet ./...`、`go test ./...` 与开发版 `desktop/bin/omnimail.exe` 构建全部通过；本次涉及的所有手写源码与测试文件均 `<= 200` 行。
- 未验证事项：真实外网 `muse.ai` 在线账号验证码交互需用户在本地实机登录窗口中手动输入安全码复测。
