# TASK-20261124-004 · 构建 Beta v0.0.1.beta.8 本地更新包

- 状态：Completed
- 范围：提交 Omni AI 摘要与拟稿拆分、邮件翻译双引擎及两者的边界加固；在当前分支构建 Windows x64 Beta 生产安装包。
- 方案：沿用现有 NSIS 生产构建链路，生成独立版本目录，不推送、不创建远程发布。
- 验证计划：按用户要求不重跑测试；只执行打包必需的编译步骤，并核对安装包的版本信息和 SHA-256。

## 构建结果

- 实现提交：`e952995297996ff73399c4a5c2d67958041442f9`（`codex/reader-toolbar-overlap`），含[摘要与拟稿拆分](TASK-20261124-001-ai-summary-draft.md)、[双引擎翻译](TASK-20261124-002-free-mail-translation.md)及[边界加固](TASK-20261124-003-translation-summary-guardrails.md)。
- 构建命令：`pwsh -NoProfile -File ./desktop/build/windows/package-windows.ps1 -Version v0.0.1.beta.8`。Wails 绑定、TypeScript 检查、Vite 生产构建、Go `windows/amd64` 编译与 NSIS `/WX` 打包均成功；Vite 主分块超过 800 kB 的提示未影响构建。
- 安装包：`dist/release/v0.0.1.beta.8/OmniMail-Setup-v0.0.1.beta.8-windows-amd64.exe`（6,895,406 字节）。产品版本 `v0.0.1.beta.8`，PE 数字版本 `0.0.1.8`。
- SHA-256：`ed06a795f7e1d4bfdcce8a5cc6d285adc00ea67b7964008d09f4363d27f1d78f`，与同目录 `SHA256SUMS.txt` 一致。
- 未重跑测试，未安装或启动应用，未推送或创建远程发布。
