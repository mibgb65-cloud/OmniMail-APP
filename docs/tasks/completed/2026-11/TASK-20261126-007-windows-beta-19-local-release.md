# TASK-20261126-007 · 构建 Beta v0.0.1.beta.19 本地更新包

- 状态：Completed
- 范围：提交邮件阅读器配色冲突修复、MSO 条件注释剥离、追踪像素静默过滤与 Gmail 会话去重（`TASK-20261126-006`），并在当前分支构建 Windows x64 Beta `v0.0.1.beta.19` 生产安装包供本地更新。
- 方案：沿用 NSIS 生产构建流水线，生成独立版本目录 `dist/release/v0.0.1.beta.19/`，不推送远程仓库、不创建远程 Release。
- 验证计划：在全量 `task verify` 通过并提交实现后，执行 `task package:windows:beta VERSION=v0.0.1.beta.19`，核对安装包版本元数据、文件大小与 SHA-256 摘要。

## 构建结果

- 实现提交：`0716d750373fa015cd7641c3b5cb523a26c3b066`（`codex/reader-toolbar-overlap`），包含：
  - [修复邮件阅读器主题配色冲突、追踪像素误报错与会话重复渲染](TASK-20261126-006-fix-reader-theme-pixel-and-dedup.md)。
- 构建命令：`task package:windows:beta VERSION=v0.0.1.beta.19`（内部执行 `powershell -NoProfile -ExecutionPolicy Bypass -File ./desktop/build/windows/package-windows.ps1 -Version "v0.0.1.beta.19"`）。Wails 绑定生成、TypeScript 校验、Vite 生产压缩构建、Go `windows/amd64` 编译与 NSIS `/WX` 零警告打包全部通过。
- 安装包：`dist/release/v0.0.1.beta.19/OmniMail-Setup-v0.0.1.beta.19-windows-amd64.exe`（7,628,347 字节，约 7.27 MB）。产品版本 `v0.0.1.beta.19`，PE 数字版本 `0.0.1.19`。
- SHA-256：`e1b3a9534372c09d69a6332a7942e6e74e7ecea38a51a0da695ee1c7ba63ae22`，与同目录 `SHA256SUMS.txt` 完全一致。
- 未自动安装或启动应用，未推送远程或创建 GitHub Release。
