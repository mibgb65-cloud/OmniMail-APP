# TASK-20261126-010 · 构建 Beta v0.0.1.beta.20 本地更新包

- 状态：Completed
- 范围：分别提交 Muse Mail 网关修复与沉浸式登录窗口自动闭环（`TASK-20261126-008`）、畸形 HTML 图片 `src` 漏开引号与存量兼容修复（`TASK-20261126-009`），并在当前分支构建 Windows x64 Beta `v0.0.1.beta.20` 生产安装包供本地更新。
- 方案：沿用 NSIS 生产构建流水线，生成独立版本目录 `dist/release/v0.0.1.beta.20/`，不推送远程仓库、不创建远程 Release。
- 验证计划：在全量 `task verify` 通过并拆分提交实现后，执行 `task package:windows:beta VERSION=v0.0.1.beta.20`，核对安装包版本元数据、文件大小与 SHA-256 摘要。

## 构建结果

- 实现提交（分支 `codex/reader-toolbar-overlap`）：
  - `76a0a5639e213cd3913bf29b574e176c0b8fc91e`：[修复 Muse Mail 网关通信异常、WebView2 登录窗口沉浸式美化与自动闭环](TASK-20261126-008-muse-gateway-fix-and-login-polish.md)；
  - `6df7d1013fe2e9108b18933d14105891e9316795`：[修复畸形 HTML 图片 src 漏开引号导致的 URL 尾随引号污染与存量兼容](TASK-20261126-009-fix-malformed-img-src-quotes.md)。
- 构建命令：`task package:windows:beta VERSION=v0.0.1.beta.20`（内部执行 `powershell -NoProfile -ExecutionPolicy Bypass -File ./desktop/build/windows/package-windows.ps1 -Version "v0.0.1.beta.20"`）。Wails 绑定生成、TypeScript 校验、Vite 生产压缩构建、Go `windows/amd64` 编译与 NSIS 零警告打包全部通过。
- 安装包：`dist/release/v0.0.1.beta.20/OmniMail-Setup-v0.0.1.beta.20-windows-amd64.exe`（7,676,414 字节，约 7.32 MB）。产品版本 `v0.0.1.beta.20`，PE 数字版本 `0.0.1.20`。
- SHA-256：`8c9e571a38da7d0f8b1277611bf09497303cdd22d013da22042ce8c8036fe163`，与同目录 `SHA256SUMS.txt` 完全一致。
- 未自动安装或启动应用，未推送远程或创建 GitHub Release。
