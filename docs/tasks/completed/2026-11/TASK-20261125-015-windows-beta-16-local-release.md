# TASK-20261125-015 · 构建 Beta v0.0.1.beta.16 本地更新包

- 状态：Completed
- 范围：提交 Muse Mail 独立隔离 WebView2 登录唤起与 Cookie 虚表偏移修复（`TASK-20261125-013`）以及裸 GB18030 邮件头容错解码、安全 `<style>`/`class` 保留、表格防逐字竖排与本地存量邮件平滑修复（`TASK-20261125-014`），并在当前分支构建 Windows x64 Beta 生产安装包供本地更新。
- 方案：沿用 NSIS 生产构建流水线，生成独立版本目录 `dist/release/v0.0.1.beta.16/`，不推送远程仓库、不创建远程 Release。
- 验证计划：在全量 `task verify` 通过并提交实现后，执行 `task package:windows:beta VERSION=v0.0.1.beta.16`，核对安装包版本元数据、文件大小与 SHA-256 摘要。

## 构建结果

- 实现提交：`9406b576349861d681723b5a721aa0654378bf56`（`codex/reader-toolbar-overlap`），包含：
  1. [修复 Muse Mail 独立 WebView2 登录窗口唤起、前置激活与 Cookie 虚表错位](TASK-20261125-013-fix-muse-webview2-login.md)；
  2. [修复邮件头裸 GB18030 解码、安全样式保留与表格列头换行，并平滑修复存量邮件](TASK-20261125-014-fix-mail-charset-css-and-table-wrap.md)。
- 构建命令：`task package:windows:beta VERSION=v0.0.1.beta.16`（内部执行 `powershell -NoProfile -ExecutionPolicy Bypass -File ./desktop/build/windows/package-windows.ps1 -Version "v0.0.1.beta.16"`）。Wails 绑定生成、TypeScript 校验、Vite 生产压缩构建、Go `windows/amd64` 编译与 NSIS `/WX` 零警告打包全部通过。
- 安装包：`dist/release/v0.0.1.beta.16/OmniMail-Setup-v0.0.1.beta.16-windows-amd64.exe`（7,573,308 字节，约 7.22 MB）。产品版本 `v0.0.1.beta.16`，PE 数字版本 `0.0.1.16`。
- SHA-256：`2591c603034a2eaf14113a8e12d5b5340fab9d4128d64e02d6f1b7b6eccdf5f2`，与同目录 `SHA256SUMS.txt` 完全一致。
- 未自动安装或启动应用，未推送远程或创建 GitHub Release。
