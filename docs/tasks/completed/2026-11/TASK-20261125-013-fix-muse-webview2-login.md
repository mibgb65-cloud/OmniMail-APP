# TASK-20261125-013 修复 Muse Mail 独立 WebView2 登录窗口唤起、前置激活与 Cookie 虚表错位

- **状态**：Completed
- **创建日期**：2026-11-25
- **完成日期**：2026-11-25
- **实现提交**：`9406b576349861d681723b5a721aa0654378bf56`（纳入 [Beta 16 本地安装包](TASK-20261125-015-windows-beta-16-local-release.md)）

## 原始需求与范围

修复 Windows 下 Muse Mail 独立隔离 WebView2 登录窗口无法唤起、未前台激活以及点击「验证并连接」时 `ICoreWebView2_2` 虚表错位导致 Cookie 提取失败/崩溃的缺陷（保留独立隔离 WebView2 登录方案）：

1. **使用 `go-webview2/pkg/combridge` 替换手写 COM 回调**：
   - 删除 `comCallbackObj` / `sharedComCallbackVtbl`，注册并创建 4 个标准 COM 回调对象（`ControllerCompleted`、`NavigationStarting`、`NewWindowRequested`、`GetCookiesCompleted`），原生堆分配并正确处理 `IUnknown` / 自身 IID `QueryInterface` 与引用计数，`HRESULT` 参数采用 `int32`，销毁时统一注销事件令牌并 `Close()` 所有 `combridge.ComObject`。
2. **补全 `webview_vtbl_windows.go` 虚表继承槽位**：
   - 严格对齐 `go-webview2@v1.0.22/pkg/edge/ICoreWebView2_2.go` 与 `ICoreWebView2Settings.go`：补全 `w2WebViewVtbl` 全部继承方法（`IUnknown` 3 槽 + `ICoreWebView2` 58 槽 = 共 61 槽，`slot 0..60`，至 `RemoveWindowCloseRequested`），`w2WebView2Vtbl` 嵌入完整 `w2WebViewVtbl`，使 `GetCookieManager` 精准落在 **slot 66**、`GetEnvironment` 落在 **slot 67**（注：`ICoreWebView2_2.go` 第 16、75 行为注释行，扣除注释行后 `ICoreWebView2` 实际为 61 槽、`GetCookieManager` 为 slot 66，已通过实机 WebView2 运行时双向调用 `GetEnvironment` 与 `GetCookieManager` 注入/读取 `hatch_sess` 验证无误）。
3. **修复 STA 线程 `S_FALSE`、窗口前置唤起、超时清理与去敏 `HRESULT` 错误透传**：
   - `CoInitializeEx(0, COINIT_APARTMENTTHREADED)` 返回 `nil`（`S_OK`）或 `Errno(1)`（`S_FALSE`）均视为成功并配对 `CoUninitialize()`；
   - 移除 `WithExclusiveUserDataFolderAccess(true)`；
   - 建窗与控制器就绪时调用 `activateLoginWindowForeground`（`ShowWindow(SW_SHOWNORMAL)`、`UpdateWindow`、短暂 `HWND_TOPMOST -> HWND_NOTOPMOST`、`BringWindowToTop`、`SetForegroundWindow`）；
   - 使用 `atomic.Uintptr` 保存 `hwnd`，`Close()` 只要 `hwnd != 0` 即投递 `wmAppShutdown`，彻底消除初始化阶段失败或超时导致的窗口/线程泄漏；
   - 环境、控制器、导航、Cookie 提取错误均附带去敏 `HRESULT` 十六进制码（如 `0x80070005`），并在 `MuseConnectModal.tsx` 与 `errorParser.ts` 确保中英文模式下清晰展示错误文案、错误码与 `HRESULT`。
4. **放宽 `login_nav_guard.go` 的 HTTPS 官方登录域名规则**：
   - 保持仅允许 `https://` 与 `about:blank`；
   - 允许精确主域及其子域：`muse.ai`、`meta.ai`、`meta.com`、`facebook.com`、`instagram.com`，以及精确 OAuth 登录域 `accounts.google.com`、`appleid.apple.com`。

## 落地变更摘要

- `desktop/internal/musemail/webview_vtbl_windows.go`：补齐 `w2WebViewVtbl`、`w2WebView2Vtbl`、`w2SettingsVtbl` 完整槽位。
- `desktop/internal/musemail/webview_com_windows.go` & `login_callbacks_windows.go`：切换至 `combridge.RegisterVTable` + `combridge.New` 标准 COM 回调桥接，附带 `HRESULT` 格式化与完整生命周期释放。
- `desktop/internal/musemail/login_host_windows.go` & `login_win32_windows.go`：兼容 `S_FALSE`、移除排他目录选项、原子 `hwnd` 安全清理与窗口前台激活。
- `desktop/internal/musemail/login_nav_guard.go` & `gateway_test.go`：扩展官方认证子域与 Google/Apple OAuth 精确域名放行。
- `desktop/frontend/src/components/onboarding/MuseConnectModal.tsx`、`desktop/frontend/src/services/errorParser.ts` & `desktop/frontend/tests/muse-mail.test.mjs`：唤起失败重置状态并保留中英双语 `HRESULT` 展示。
- `desktop/internal/musemail/webview_vtbl_windows_test.go`：新增静态虚表偏移断言、`S_FALSE` 断言、子域放行/拦截断言，以及 Windows 实机启动独立 WebView2 宿主、调用 `GetEnvironment` / `GetCookieManager` 写入并异步提取 `hatch_sess` Cookie 闭环测试。

## 验证结果

- `task format` 与全仓手写源码单文件 `<= 200` 行检查：通过。
- `go test -v -count=1 ./internal/musemail/...`：全部通过（含 Windows 实机 WebView2 建窗 + `hatch_sess` Cookie 注入/异步提取/清理全流程测试）。
- `task verify` 与 `task build`（含最新 `desktop/bin/omnimail.exe` 开发程序生成）：全部零错误通过。
