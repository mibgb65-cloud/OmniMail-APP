# TASK-20261125-006 · 构建 Beta v0.0.1.beta.13 本地更新包

- 状态：Completed
- 范围：提交腾讯 WorkBuddy Agent 邮箱原生接入功能（`internal/workbuddymail`、`WorkBuddyMailService`、`WorkBuddyConnectModal`、`WorkBuddyMailView` 及中英双语适配），并在当前分支构建 Windows x64 Beta 生产安装包供本地更新。
- 方案：沿用 NSIS 生产构建流水线，生成独立版本目录 `dist/release/v0.0.1.beta.13/`，不推送远程仓库、不创建远程 Release。
- 验证计划：在全量 `task verify` 通过并提交实现后，执行 `task package:windows:beta VERSION=v0.0.1.beta.13`，核对安装包版本元数据、文件大小与 SHA-256 摘要。

## 构建结果

- 实现提交：`d0bce87c9ef545430392e945c8e345016b923748`（`codex/reader-toolbar-overlap`），含[腾讯 WorkBuddy Agent 邮箱原生接入](TASK-20261125-005-workbuddy-agent-mail.md)。
- 构建命令：`task package:windows:beta VERSION=v0.0.1.beta.13`（内部执行 `powershell -NoProfile -ExecutionPolicy Bypass -File ./desktop/build/windows/package-windows.ps1 -Version "v0.0.1.beta.13"`）。Wails 绑定生成、TypeScript 校验、Vite 生产压缩构建、Go `windows/amd64` 编译与 NSIS `/WX` 零警告打包全部通过。
- 安装包：`dist/release/v0.0.1.beta.13/OmniMail-Setup-v0.0.1.beta.13-windows-amd64.exe`（7,532,000 字节，约 7.18 MB）。产品版本 `v0.0.1.beta.13`，PE 数字版本 `0.0.1.13`。
- SHA-256：`45d115d211a2b4c21d578745d3b52bba7f8b095c03752ebc7694149947cf0f95`，与同目录 `SHA256SUMS.txt` 完全一致。
- 未自动安装或启动应用，未推送远程或创建 GitHub Release。
