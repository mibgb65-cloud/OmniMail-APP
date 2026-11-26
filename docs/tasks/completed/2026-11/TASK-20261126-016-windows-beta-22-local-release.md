# TASK-20261126-016 · 构建 Beta v0.0.1.beta.22 本地更新包

- 状态：Completed
- 范围：分别提交写信内联 AI 生成态协同锁定与四层流光动效（`TASK-20261126-014`）及全站邮箱账户选择器收起态真实邮箱副标题修复（`TASK-20261126-015`），并在当前分支构建 Windows x64 Beta `v0.0.1.beta.22` 生产安装包供本地更新。
- 方案：沿用 NSIS 生产构建流水线，生成独立版本目录 `dist/release/v0.0.1.beta.22/`，不推送远程仓库、不创建远程 Release。
- 验证计划：在全量 `task verify` 通过并拆分提交实现后，执行 `task package:windows:beta VERSION=v0.0.1.beta.22`，核对安装包版本元数据、文件大小与 SHA-256 摘要。

## 构建结果

- 实现提交（分支 `codex/reader-toolbar-overlap`）：
  - `7277164a4c30c3f2ebe58de490f00e9bc9ab40a6`：[写信内联 AI 升级（生成态严格输入锁定、只读协同保护与四层 60fps 流光动效）](TASK-20261126-014-compose-inline-ai-lock-and-motion.md)；
  - `0d5e7dccdf3d6d6aed18bd53aa1b6c764d2d64ee`：[统一全站邮箱账户下拉选择器收起态副标题（真实邮箱地址）展示](TASK-20261126-015-account-select-trigger-sublabel.md)。
- 构建命令：`task package:windows:beta VERSION=v0.0.1.beta.22`（内部执行 `powershell -NoProfile -ExecutionPolicy Bypass -File ./desktop/build/windows/package-windows.ps1 -Version "v0.0.1.beta.22"`）。Wails 绑定生成、TypeScript 校验、Vite 生产压缩构建、Go `windows/amd64` 编译与 NSIS 零警告打包全部通过。
- 安装包：`dist/release/v0.0.1.beta.22/OmniMail-Setup-v0.0.1.beta.22-windows-amd64.exe`（7,688,121 字节，约 7.33 MB）。产品版本 `v0.0.1.beta.22`，PE 数字版本 `0.0.1.22`。
- SHA-256：`6e1f0e0b251f204aae34c2accbb7578dc308ccd12b4d0f6a074d946834f4710f`，与同目录 `SHA256SUMS.txt` 完全一致。
- 未自动安装或启动应用，未推送远程或创建 GitHub Release。
