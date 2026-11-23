# TASK-20261123-004：升级 Windows x64 NSIS 安装向导、Local Profiles 目录适配与双轨版本号打包体系

## 状态
Completed

## 原始需求
完善并升级 Windows x64 生产端 NSIS 交互式安装向导（`.exe`）与一键打包脚本（`desktop/build/windows/package-windows.ps1` + `desktop/build/windows/installer/*.nsi/*.nsh`），全面适配多本地空间（Local Profiles）架构、Windows 注册表规范与双轨版本号体系，并完成真实双版本编译打包验证。

## 实际改动
1. **双轨版本号单一来源注入**：
   - 新增 `desktop/version.go`（132 行），由 `-ldflags` 注入 `main.AppVersion`、`main.ReleaseChannel`（`stable` / `beta`）、`main.BuildTime`，提供 `DesktopService.GetAppBuildInfo()` 与双轨版本比较 `isNewerReleaseVersion`；
   - 更新 `desktop/desktop_extras.go`（190 行）、前端 `ShortcutsAndAboutTabs.tsx`（170 行）与 `UpdateFlowModal.tsx`（109 行），使关于页与更新检查版本、通道标签（`Stable 正式版` / `Beta 测试版`）与构建包一致；
   - 更新 `desktop/window_boot.go`（154 行）与 `desktop/main.go`（175 行），支持安装/卸载器调用 `--quit-existing` 温和退出托盘实例安全落盘 SQLite WAL，并精确区分 `--autostart` 与 `--silent-tray` 静默托盘驻留。
2. **NSIS 模块化安装向导与注册表规范升级**：
   - 新增根目录 `LICENSE`（MIT），将向导拆分为 6 个 `< 200` 行的 UTF-8 脚本模块：`omnimail.nsi`（194 行）、`omnimail-lang.nsh`（122 行）、`omnimail-assoc.nsh`（86 行）、`omnimail-json-fs.nsh`（123 行）、`omnimail-helpers.nsh`（134 行）、`omnimail-pages.nsh`（198 行）、`omnimail-sections.nsh`（115 行）；
   - 实现 8 页安装流程（`Welcome`、`License`、`InstallMode`、`Directory`、`DataDirPage`、`Components`、`InstFiles`、`Finish`）与 4 页安全卸载流程；
   - 实现 Win10/11 x64 检测、WebView2 Runtime 检测与官方下载指引、运行中 `OmniMail.exe` 检测与温和退出、`/S` / `/CurrentUser` / `/AllUsers` / `/INSTDIR=` / `/DATADIR=` 参数支持；
   - `DataDirPage` 支持从既有 `%APPDATA%\OmniMail\bootstrap.json` 读取路径、实时计算目标盘剩余空间、五重边界校验，安装时按 Local Profiles 架构初始化 `profiles/` 与 `logs/`，覆盖升级未改路径时完整保留既有 `bootstrap.json`；
   - 规范写入 64 位注册表（`SHCTX\Software\OmniMail`、`HKCU\Software\OmniMail\DataDir`、`App Paths\OmniMail.exe`、`Uninstall\OmniMail` 完整字段、`Clients\Mail\OmniMail` + `OpenWithProgids` 安全关联，不覆写全局 `Classes\mailto`）。
3. **构建脚本、Taskfile 与文档同步**：
   - 升级 `desktop/build/windows/package-windows.ps1`（172 行），支持双轨正则校验、临时 `.info.generated.json` 动态生成与自动清理、`makensis /WX` 零警告门禁及全目录 `SHA256SUMS.txt` 汇总；
   - 在 `Taskfile.yml` 新增 `package:windows:stable` 与 `package:windows:beta`，同步更新 `docs/development/BUILD.md`。

## 验证结果
- 已通过：`task verify` 与 `go test -count=1 ./...`（12 个测试包含双轨版本比较与启动参数单测全部通过）；
- 已通过：非法版本号（如 `0.0.1`）拦截测试返回非零退出码与清晰中文报错；
- 已通过：`-Version v0.0.1`（`stable` -> `PE 0.0.1.0`）与 `-Version v0.0.1.beta.1`（`beta` -> `PE 0.0.1.1`）两轮完整生产打包（NSIS `/WX` 零警告通过），工作区无临时 `.syso` 或模板污染。
- 未验证事项：EV 代码签名证书加签需在正式发版环境注入硬件令牌后执行。
- 关联文档：[构建与发版打包](../../../development/BUILD.md)、[产品范围](../../../product/PRD.md)、[当前状态](../../../plans/CURRENT.md)。
- Git 提交：实现提交 `3cbd1bd`、`4697c40`、`c86e4d0`。
