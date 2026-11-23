# TASK-20261123-025 构建 Beta v0.0.1.beta.6 本地更新包

状态：Completed

## 范围

- 提交自 `v0.0.1.beta.5` 以来的任务 021–024：AI 摘要标签、未读阅读行为、邮件列表回顶胶囊与译文逐批显示。
- 使用项目生产打包脚本构建 Windows x64 Beta 安装包。按用户要求不重跑测试、不安装、不启动、不推送；保留构建必要的类型检查并核对 PE 版本与 SHA-256。
- 记录实现提交、版本与产物，并更新各已完成任务的交付状态。

## 构建结果

- 代码提交与打包基线：`4b80afa5cbcad3978221acf411b189afa0676333`（`codex/reader-toolbar-overlap`）。
- 构建命令：`pwsh -NoProfile -File ./desktop/build/windows/package-windows.ps1 -Version v0.0.1.beta.6`。Wails 绑定、TypeScript、Vite 生产构建、Go `windows/amd64` 生产编译、NSIS `/WX` 打包均完成；Vite 报告主分块超过 800 kB 的非阻塞提示。
- 本地安装包：`dist/release/v0.0.1.beta.6/OmniMail-Setup-v0.0.1.beta.6-windows-amd64.exe`（6,880,863 字节）。已核对产品版本 `v0.0.1.beta.6` 与 PE 版本 `0.0.1.6`。
- SHA-256：`3f621230b6ca2a93dafd6f38c1571f4c66b8bed326e322aebbc25b4201e08221`，与同目录 `SHA256SUMS.txt` 一致。
- 按用户要求未重跑测试套件，未安装、启动应用、推送或创建远程发布。
