# TASK-20261122-005：Windows 交互式安装包（NSIS）、自定义数据目录迁移与桌面端运行时能力

## 状态

Completed

## 原始需求

为 OmniMail 桌面端项目（Wails v3 + Go + React + TypeScript）完成正式版 Windows 安装包改造与桌面端核心运行能力闭环：

1. **Windows 交互式安装向导（NSIS `.exe`）与便携包（`.zip`）**：
   - 禁用一键静默强装 C 盘，支持「仅为当前用户安装 / 为所有用户安装」与自由修改程序安装目录（如 D 盘）；
   - 默认简体中文（兼容英文），生成并嵌入多尺寸 Prism Wing `.ico` 应用图标与 EXE 版本信息；
   - 支持可勾选安装项：创建桌面快捷方式（默认勾选）、创建开始菜单快捷方式（默认勾选）、开机自动启动并静默驻留托盘（可选）、注册 `mailto:` 协议及 `.eml` / `.ics` 文件关联（可选）、安装完成后立即启动 OmniMail（默认勾选）；
   - 覆盖升级安装绝不清空用户数据目录；卸载向导提供默认不勾选的「同时删除本地邮件缓存与账户配置」选项。
2. **数据存储位置与安装目录彻底解耦（双入口 + 安全迁移）**：
   - `%APPDATA%\OmniMail\bootstrap.json` 仅保存极简引导配置 `{ "dataDir": "...", "initialized": true }`，所有本地数据读写统一由 `getDataDir()` 驱动；
   - **入口 A**：NSIS 安装向导新增「选择数据存储目录」自定义页，同时应用首次启动引导支持查看/修改数据目录与初始化偏好（亮/暗/跟随系统主题、语言、关闭最小化到托盘或直接退出、开机自启）；
   - **入口 B**：「设置 → 存储与数据」展示当前数据目录与磁盘空间，提供「打开数据目录」与「更改数据存储位置」（目录选择、读写权限与剩余空间校验、数据复制校验与可选保留原副本、更新 `bootstrap.json` 并重启生效）。
3. **桌面端必备能力补齐**：
   - 单实例锁（重复启动唤醒已有主窗口并透传 `mailto:` / `.eml` / `.ics` 启动参数）；
   - 最小窗口尺寸锁定 `960×640`，持久化记忆窗口位置、宽高与最大化状态；
   - 系统托盘与关闭行为联动（右键菜单含「打开 OmniMail / 写新邮件 / 立即同步 / 退出」）；
   - 生产构建禁用 DevTools 与黑框控制台，静态资源在打包协议下完整加载且首帧零白屏。
4. **一键打包脚本与产物验证**：
   - 补齐 `package.json`（`npm run build:win` / `pnpm build:win`）与 `Taskfile.yml`（`task package:win`），实际执行生产构建生成安装向导 `.exe` 与便携版 `.zip` 并校验产物完整性。

## 实际落地结果

1. **图标与 Windows 原生资源嵌入**：
   - 渲染 `512×512` `desktop/build/appicon.png` 并生成多尺寸（256/128/64/48/32/16）`desktop/build/windows/icon.ico`；配置双语 `info.json` 与 `PerMonitorV2` DPI `wails.exe.manifest`，打包时自动通过 `wails3 generate syso` 编译进 `OmniMail.exe`（PE 子系统 `WINDOWS_GUI = 2` 无黑框，`-tags production` 关闭生产环境 DevTools）。
2. **Go 后端引导解耦、数据迁移与桌面运行能力**：
   - 新增 `bootstrap_store.go`、`storage_migration.go`、`storage_commit.go`、`disk_space_windows.go`、`window_state.go`、`tray_and_instance.go`、`service_runtime.go`、`buildmode_*.go`，扩展 `desktop_service.go` 与 `main.go`：
     - `%APPDATA%\OmniMail\bootstrap.json` 严格只保存 `{ "dataDir", "initialized" }`，所有本地持久化目录（`db`、`cache/mail`、`cache/attachments`、`index`、`exports`、`logs`、`preferences.json`、`window-state.json`）均收敛至 `getDataDir()`；
     - 迁移前执行路径冲突拦截（禁止选盘符根目录、程序安装目录或新旧父子嵌套）、真实文件写入探测与磁盘剩余容量校验，复制核验字节数后原子替换 `bootstrap.json`；
     - 启用 `SingleInstance`（`com.omnimail.desktop.client`）、`960×640` 窗口状态持久化、系统托盘四项标准菜单与关闭到托盘拦截钩子。
3. **前端双入口数据目录配置与偏好联动**：
   - 新增 `storageHelpers.ts`、`desktopActions.ts`、`useDesktopBridge.ts`、`OnboardingInitCard.tsx`、`DataDirMigrateModal.tsx`，拆分 `PrivacyTab.tsx` 与 `StorageTab.tsx`，升级 `GeneralTab.tsx`（新增「跟随系统」主题）、`OnboardingScreen.tsx` 与 `vite.config.ts`（相对路径 `base: "./"`）。
4. **NSIS 交互式安装向导与一键打包脚本**：
   - 编写 `desktop/build/windows/installer/omnimail.nsi` 及 `omnimail-lang.nsh`、`omnimail-pages.nsh`、`omnimail-assoc.nsh`（支持当前用户/所有用户模式、自选安装盘符、自定义数据目录页、5 项组件勾选、覆盖升级保留数据与默认不删本地数据的卸载保护页）；
   - 新增 `desktop/build/windows/package-windows.ps1`，并在根目录 `package.json`、`desktop/frontend/package.json`、`Taskfile.yml` 注册 `npm run build:win` / `pnpm build:win` / `task package:win`，同步更新 `BUILD.md`、`OVERVIEW.md`、`PRD.md`、`CURRENT.md`。

## 验证记录

- 全仓手写文件行数审计：178 个手写源码及脚本文件全部 `<= 200` 行（`> 200` 行文件数为 `0`）。
- `task verify`：退出码 `0`（Prettier、ESLint、`tsc --noEmit`、Vite 构建、`go vet`、`go test` 全部通过）。
- `npm run build:win`：成功产出 `dist/release/OmniMail-Setup-0.1.0-windows-amd64.exe`、`dist/release/OmniMail-Portable-0.1.0-windows-amd64.zip` 与 `dist/release/SHA256SUMS.txt`；PE 头核验 `Subsystem = 2 (WINDOWS_GUI)`、版本信息 `0.1.0`、内嵌图标与相对静态资源路径均正常。
- **关联文档**：[构建与发版打包](../../../development/BUILD.md)、[架构概览](../../../architecture/OVERVIEW.md)、[产品范围](../../../product/PRD.md)、[当前状态](../../../plans/CURRENT.md)。
- **Git 提交**：实现提交 `3cbd1bd`、`4697c40`、`c86e4d0`。
