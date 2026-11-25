# TASK-20261125-004 · 构建 Beta v0.0.1.beta.12 本地更新包

- 状态：Completed
- 范围：提交 Meta Muse Mail（`@muse.ai`）独立隔离 WebView2 官方网页登录与 Go 原生只读接入功能（`internal/musemail`、`MuseMailService`、`MuseConnectModal`、`MuseMailView` 及双语适配），并在当前分支构建 Windows x64 Beta 生产安装包供本地更新。
- 方案：沿用 NSIS 生产构建流水线，生成独立版本目录 `dist/release/v0.0.1.beta.12/`，不推送远程仓库、不创建远程 Release。
- 验证计划：在全量 `task verify` 通过并提交实现后，执行 `task package:windows:beta VERSION=v0.0.1.beta.12`，核对安装包版本元数据、文件大小与 SHA-256 摘要。

## 构建结果

- 实现提交：`39d1c53a5f7476899679cf5b936e7af3ad267034`（`codex/reader-toolbar-overlap`），含[Meta Muse Mail 独立网页登录与原生只读接入](TASK-20261125-003-muse-mail-native-readonly.md)。
- 构建命令：`task package:windows:beta VERSION=v0.0.1.beta.12`（内部执行 `powershell -NoProfile -ExecutionPolicy Bypass -File ./desktop/build/windows/package-windows.ps1 -Version "v0.0.1.beta.12"`）。Wails 绑定生成、TypeScript 校验、Vite 生产压缩构建、Go `windows/amd64` 编译与 NSIS `/WX` 零警告打包全部通过。
- 安装包：`dist/release/v0.0.1.beta.12/OmniMail-Setup-v0.0.1.beta.12-windows-amd64.exe`（7,459,199 字节，约 7.11 MB）。产品版本 `v0.0.1.beta.12`，PE 数字版本 `0.0.1.12`。
- SHA-256：`7f8748848ec5abf27bff395b2197e2fd7dd0a3dab2160857d47f39c8ea663fd8`，与同目录 `SHA256SUMS.txt` 完全一致。
- 未自动安装或启动应用，未推送远程或创建 GitHub Release。
