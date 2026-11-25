# TASK-20261125-012 · 构建 Beta v0.0.1.beta.15 本地更新包

- 状态：Completed
- 范围：提交腾讯 WorkBuddy Agent 邮箱已开通账号状态映射（`"active"` -> `StatusRunning`）与连接器错误透传、`openedAt` 多态解析、`12151` 持续轮询、`X-Product: SaaS` 请求头及官方域名白名单加固（`TASK-20261125-011`），并在当前分支构建 Windows x64 Beta 生产安装包供本地更新。
- 方案：沿用 NSIS 生产构建流水线，生成独立版本目录 `dist/release/v0.0.1.beta.15/`，不推送远程仓库、不创建远程 Release。
- 验证计划：在全量 `task verify` 通过并提交实现后，执行 `task package:windows:beta VERSION=v0.0.1.beta.15`，核对安装包版本元数据、文件大小与 SHA-256 摘要。

## 构建结果

- 实现提交：`48f2c0efc57a3ebb4235195987796d67a0c21c11`（`codex/reader-toolbar-overlap`），包含[修复 WorkBuddy Agent 邮箱已开通账号误判未绑定与边界容错](TASK-20261125-011-fix-workbuddy-active-status.md)。
- 构建命令：`task package:windows:beta VERSION=v0.0.1.beta.15`（内部执行 `powershell -NoProfile -ExecutionPolicy Bypass -File ./desktop/build/windows/package-windows.ps1 -Version "v0.0.1.beta.15"`）。Wails 绑定生成、TypeScript 校验、Vite 生产压缩构建、Go `windows/amd64` 编译与 NSIS `/WX` 零警告打包全部通过。
- 安装包：`dist/release/v0.0.1.beta.15/OmniMail-Setup-v0.0.1.beta.15-windows-amd64.exe`（7,544,813 字节，约 7.20 MB）。产品版本 `v0.0.1.beta.15`，PE 数字版本 `0.0.1.15`。
- SHA-256：`68d7e6be9a509645f0760a4af5f52938253ad312c6b0a57ffe327278470681ee`，与同目录 `SHA256SUMS.txt` 完全一致。
- 未自动安装或启动应用，未推送远程或创建 GitHub Release。
