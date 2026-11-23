# TASK-20261123-020 构建 Beta v0.0.1.beta.5 本地更新包

状态：Completed

## 范围

- 提交自 `v0.0.1.beta.4` 以来的任务 014–019：滚动渐隐、Heroicons、阅读工具栏、Omni AI、邮件翻译与通讯录重复合并。
- 使用项目 Windows x64 生产打包脚本构建 `v0.0.1.beta.5`。按用户要求不重跑测试、不安装、不启动、不推送；保留生产构建必需的类型检查，检查安装包 PE 版本与 SHA-256。
- 将本地构建结果、提交和产物路径写入本任务，并更新已完成任务的交付状态。

## 构建结果

- 代码提交与打包基线：`89334e74ff86ddc51f934c34341582adcb5ae949`（`codex/reader-toolbar-overlap` 分支）。
- 构建命令：`pwsh -NoProfile -File ./desktop/build/windows/package-windows.ps1 -Version v0.0.1.beta.5`。Wails 绑定、TypeScript、Vite 生产构建、Go `windows/amd64` 生产编译和 NSIS `/WX` 打包均通过；Vite 报告主分块超过 800 kB 的非阻塞提示。
- 安装包：`dist/release/v0.0.1.beta.5/OmniMail-Setup-v0.0.1.beta.5-windows-amd64.exe`（6,871,126 字节）。已核对产品版本 `v0.0.1.beta.5` 和 PE 四段版本 `0.0.1.5`。
- SHA-256：`7c74e02466e1b54c4f3b27b0eb5d4999794a2eaef3a10a4960139bf013aa939f`，与同目录下 `SHA256SUMS.txt` 一致。
- 按用户要求沿用上一轮验证结果，未运行测试套件，未安装、启动应用、推送或创建远程发布。
