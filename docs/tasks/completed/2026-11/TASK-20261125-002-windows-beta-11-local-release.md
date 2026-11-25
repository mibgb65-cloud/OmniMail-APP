# TASK-20261125-002 · 构建 Beta v0.0.1.beta.11 本地更新包

- 状态：Completed
- 范围：提交邮箱接入指引与授权弹窗双栏高保真重构（`ProviderGuideModal`、`PreparationGuideCard`、`OAuthFlowModal`、`ManualImapModal` 及双语预设目录升级），并在当前分支构建 Windows x64 Beta 生产安装包供本地更新。
- 方案：沿用 NSIS 生产构建流水线，生成独立版本目录 `dist/release/v0.0.1.beta.11/`，不推送远程仓库、不创建远程 Release。
- 验证计划：在全量 `task verify` 通过并提交实现后，执行 `task package:windows:beta VERSION=v0.0.1.beta.11`，核对安装包版本元数据、文件大小与 SHA-256 摘要。

## 构建结果

- 实现提交：`8d9cef87340d19bb81b1452eb4e27fd8fbd646c3`（`codex/reader-toolbar-overlap`），含[邮箱接入指引与授权弹窗双栏高保真重构](TASK-20261125-001-provider-connect-modals-redesign.md)。
- 构建命令：`task package:windows:beta VERSION=v0.0.1.beta.11`（内部执行 `powershell -NoProfile -ExecutionPolicy Bypass -File ./desktop/build/windows/package-windows.ps1 -Version "v0.0.1.beta.11"`）。Wails 绑定生成、TypeScript 校验、Vite 生产压缩构建、Go `windows/amd64` 编译与 NSIS `/WX` 零警告打包全部通过。
- 安装包：`dist/release/v0.0.1.beta.11/OmniMail-Setup-v0.0.1.beta.11-windows-amd64.exe`（7,000,025 字节，约 6.68 MB）。产品版本 `v0.0.1.beta.11`，PE 数字版本 `0.0.1.11`。
- SHA-256：`032dfc574b09cf2a55049c2c2f7fea64eca8860b8602c64e1aacb00108f9eb46`，与同目录 `SHA256SUMS.txt` 完全一致。
- 未自动安装或启动应用，未推送远程或创建 GitHub Release。
