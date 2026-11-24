# TASK-20261124-002 构建 Beta v0.0.1.beta.7 本地更新包

状态：Completed

## 范围

- 提交 [邮件阅读工具栏单行修复](TASK-20261124-001-reader-toolbar-single-row.md)，以该提交为基线构建 Windows x64 Beta 本地更新包。

## 构建结果

- 实现提交：`d1031a18bc8a0d8d751be77294a82204a514740c`（`codex/reader-toolbar-overlap`）。
- 构建命令：`pwsh -NoProfile -File ./desktop/build/windows/package-windows.ps1 -Version v0.0.1.beta.7`。Wails 绑定、TypeScript 检查、Vite 生产构建、Go `windows/amd64` 编译与 NSIS `/WX` 打包均成功。Vite 主分块超过 800 kB，提示不影响打包。
- 安装包：`dist/release/v0.0.1.beta.7/OmniMail-Setup-v0.0.1.beta.7-windows-amd64.exe`（6,878,693 字节）。产品版本为 `v0.0.1.beta.7`，PE 版本为 `0.0.1.7`。
- SHA-256：`526433c57afc37127d0806288d4356c69bcd8cfaa75df91f062fe8ca8f0acc5d`，与同目录 `SHA256SUMS.txt` 一致。
- 按用户要求未重跑测试，未安装或启动应用，未推送或创建远程发布。
