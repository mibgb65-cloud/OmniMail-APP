# TASK-20261127-002 · 构建 Beta v0.0.1.beta.24 本地更新包

- 状态：Completed
- 范围：分别提交邮件 CSS/HTML 远程背景图可逆还原与存量 `.eml.zst` 恢复（`TASK-20261126-020`）及 6 家企业邮箱官方品牌高清透明图标替换（`TASK-20261127-001`），并在当前分支构建 Windows x64 Beta `v0.0.1.beta.24` 生产安装包供本地更新。
- 方案：沿用 NSIS 生产构建流水线，生成独立版本目录 `dist/release/v0.0.1.beta.24/`，不推送远程仓库、不创建远程 Release。
- 验证计划：在全量 `task verify` 通过并拆分提交实现后，执行 `task package:windows:beta VERSION=v0.0.1.beta.24`，核对安装包版本元数据、文件大小与 SHA-256 摘要。

## 构建结果

- 实现提交（分支 `codex/reader-toolbar-overlap`）：
  - `7ce7722e2d6891ae96bc7bb86347f06629b85a90`：[修复邮件 CSS/HTML 远程背景图放行空白并支持存量 `.eml.zst` 按需恢复](TASK-20261126-020-reversible-css-background-images.md)；
  - `9acfab4f45805a1803d09ef81d55cfaa8263e984`：[企业邮箱官方品牌高清透明图标替换与 `ProviderIcon` 统一管线](TASK-20261127-001-enterprise-official-brand-icons.md)。
- 构建命令：`task package:windows:beta VERSION=v0.0.1.beta.24`（内部执行 `powershell -NoProfile -ExecutionPolicy Bypass -File ./desktop/build/windows/package-windows.ps1 -Version "v0.0.1.beta.24"`）。Wails 绑定生成、TypeScript 校验、Vite 生产压缩构建、Go `windows/amd64` 编译与 NSIS 零警告打包全部通过。
- 安装包：`dist/release/v0.0.1.beta.24/OmniMail-Setup-v0.0.1.beta.24-windows-amd64.exe`（7,749,570 字节，约 7.39 MB）。产品版本 `v0.0.1.beta.24`，PE 数字版本 `0.0.1.24`。
- SHA-256：`b512ecd3924e5cbe9b7d43c6be3763a559c8785de41b8f1c2d0260c3196cd7cf`，与同目录 `SHA256SUMS.txt` 完全一致。
- 未自动安装或启动应用，未推送远程或创建 GitHub Release。
