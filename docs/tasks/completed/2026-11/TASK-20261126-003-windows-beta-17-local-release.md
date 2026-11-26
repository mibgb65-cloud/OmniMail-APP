# TASK-20261126-003 · 构建 Beta v0.0.1.beta.17 本地更新包

- 状态：Completed
- 范围：提交企业邮箱预设与 DNS MX 自动识别、侧边栏精简显示及双入口重命名闭环（`TASK-20261126-001`）以及 WorkBuddy / Muse 智能体邮箱统一三栏工作台重构（`TASK-20261126-002`），并在当前分支构建 Windows x64 Beta 生产安装包供本地更新。
- 方案：沿用 NSIS 生产构建流水线，生成独立版本目录 `dist/release/v0.0.1.beta.17/`，不推送远程仓库、不创建远程 Release。
- 验证计划：在全量 `task verify` 通过并提交实现后，执行 `task package:windows:beta VERSION=v0.0.1.beta.17`，核对安装包版本元数据、文件大小与 SHA-256 摘要。

## 构建结果

- 实现提交：`c67cf462d18a93f8910e2fef8e0c1571e76fc8d4`（`codex/reader-toolbar-overlap`），包含：
  1. [企业邮箱预设与 MX 自动识别、侧边栏账户精简显示及双入口重命名闭环](TASK-20261126-001-enterprise-mail-and-account-naming.md)；
  2. [智能体邮箱（WorkBuddy & Muse）统一三栏工作台重构](TASK-20261126-002-agent-mail-unified-workspace.md)。
- 构建命令：`task package:windows:beta VERSION=v0.0.1.beta.17`（内部执行 `powershell -NoProfile -ExecutionPolicy Bypass -File ./desktop/build/windows/package-windows.ps1 -Version "v0.0.1.beta.17"`）。Wails 绑定生成、TypeScript 校验、Vite 生产压缩构建、Go `windows/amd64` 编译与 NSIS `/WX` 零警告打包全部通过。
- 安装包：`dist/release/v0.0.1.beta.17/OmniMail-Setup-v0.0.1.beta.17-windows-amd64.exe`（7,586,923 字节，约 7.24 MB）。产品版本 `v0.0.1.beta.17`，PE 数字版本 `0.0.1.17`。
- SHA-256：`33e3e6e5b2d9ac1fb73f8419ecf07d8571ac78285547d9e0fa8343161749fafb`，与同目录 `SHA256SUMS.txt` 完全一致。
- 未自动安装或启动应用，未推送远程或创建 GitHub Release。
