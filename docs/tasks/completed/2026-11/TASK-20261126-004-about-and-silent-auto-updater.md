# TASK-20261126-004 · 关于页重构与静默自动更新闭环

- 状态：Completed
- 范围：
  1. 在 NSIS 安装器 `desktop/build/windows/installer/omnimail.nsi` 中新增 `/RELAUNCH` 静默升级后自动拉起新版支持（兼容 `CurrentUser` 与 `AllUsers` 非提权拉起），保留用户既有开机自启与 `bootstrap.json` 数据目录配置；
  2. 在 Go 后端新增 `desktop/internal/updater/` 与 `desktop/updater_service.go`，支持 `DesktopPreferences` 更新偏好持久化（旧版配置向后兼容且切换主题/语言不丢失）、Stable / Beta 双通道 GitHub Release 检查与真实错误上报、受信任 HTTPS 域名与重定向流式下载、`<os.TempDir()>/OmniMail-Updates` `.part` 进度事件与 `SHA256SUMS.txt` 严格校验、以及 Windows NSIS 静默覆盖安装并自动重启（含未安装 `dev` 便携模式降级兜底）；
  3. 前端实现全局 `useUpdateStore`（启动 10 秒首次静默检测 + 12 小时复查 + `updater:progress` 实时同步 + 写信草稿保护）、首页顶栏 `TopBarUpdateChip` 四级响应式适配（`wide` / `laptop` / `compact` / `< 860px` 极窄圆点）与视口钳位 `TopBarUpdatePopover`；
  4. 重构「设置 → 关于 OmniMail」三卡片布局、统一左下角真实版本号与红点提示、升级 `UpdateFlowModal`，并彻底移除「工作台运行态横幅预览（界面验收入口）」及废弃 i18n 词条。

## 实际改动

- **NSIS 静默自动重启**：`desktop/build/windows/installer/omnimail.nsi` 新增 `Var RelaunchAfterInstall` 与 `.onInstSuccess`，解析 `/RELAUNCH` 并在 `${Silent}` 完成后自动拉起新版 `OmniMail.exe`，不篡改 `SecAutostart` / `SecSilentTray` 注册表自启配置。
- **Go 静默更新引擎**：
  - `desktop/internal/updater/{models,version,security,feed,downloader,downloader_run,cmd_builder,installer_windows,installer_other}.go`：实现双通道版本筛选、受控 HTTPS 白名单校验、`SHA256SUMS.txt` 解析与文件强校验、`.part` 流式下载与异常清理，以及 Windows `SysProcAttr.CmdLine` 尾参无引号 `/D=<installDir>` 构造。
  - `desktop/{bootstrap_store,window_boot,desktop_service,storage_commit,service_runtime,updater_service,version,main}.go`：持久化更新配置并隔离通用偏好合并，暴露 `CheckForUpdates`、`GetUpdatePreferences`、`UpdateUpdatePreferences`、`SkipUpdateVersion`、`DownloadUpdate`、`CancelUpdateDownload`、`InstallDownloadedUpdate`、`OpenUpdateDownloadDir` 8 个 Wails 强类型 RPC 方法与 `updater:progress` 实时事件。
- **前端全局更新流、顶栏四档自适应与关于页重构**：
  - `desktop/frontend/src/state/{useUpdateStore,useUpdateScheduler,useUpdateActions,updateProgressHandler}.ts`、`src/services/updaterApi.ts`、`src/utils/updateFormat.ts`；
  - `desktop/frontend/src/components/shell/{TopBar,TopBarUpdateChip,TopBarUpdatePopover,TopBarUpdatePopoverActions}.tsx` 与 `src/styles/{topbar-update,topbar-update-popover}.css`；
  - `desktop/frontend/src/components/settings/{SettingsModal,SettingsSidebarNav,ShortcutsAndAboutTabs,AboutVersionCard}.tsx`、`src/components/overlays/{UpdateFlowModal,UpdateFlowModalBody}.tsx`、`src/styles/about-updater.css` 及中英双语 `src/i18n/{zh,en}/updater.ts`。
- **同步文档**：[PRD.md](../../../product/PRD.md)、[CURRENT.md](../../../plans/CURRENT.md)。

## 验证结果

- `go test ./internal/updater .` 与全量 `task verify`（`gofmt`、Prettier、ESLint 零警告、`tsc --noEmit`、前端全部测试含 `updater-ui.test.mjs` 与 `i18n.test.mjs`、`go vet`、`go test ./...`）全部通过。
- 所有新增与修改的手写源码文件均严格控制在 `<= 200` 行以内。
- `task build` 开发构建与 Windows NSIS `v0.0.1.beta.18` 生产打包（`/WX` 零警告）通过。
