# TASK-20261124-010 · 构建 Beta v0.0.1.beta.9 本地更新包

- 状态：Completed
- 范围：提交全仓零原生控件改造、AI 关键时间防溢出、正文回到顶部轻胶囊、DMARC 对齐与三段式安全警示横幅、以及全站中英双语（`zh-CN` / `en-US`）国际化实现；在当前分支构建 Windows x64 Beta 生产安装包供本地更新。
- 方案：沿用现有 NSIS 生产构建链路，生成独立版本目录 `dist/release/v0.0.1.beta.9/`，不推送、不创建远程发布。
- 验证计划：按用户要求不重跑测试；只执行打包必需的编译与封装步骤，并核对安装包的版本信息、文件大小与 SHA-256。

## 构建结果

- 实现提交：`10e54548e47b0574ccbed4ef1031e4c1ef2dc24f`（`codex/reader-toolbar-overlap`），含[清理残留原生控件与门禁](TASK-20261124-005-eliminate-native-controls.md)、[AI 关键时间长文本防溢出](TASK-20261124-006-ai-deadline-row-overflow.md)、[阅读区回到顶部悬浮轻胶囊](TASK-20261124-007-reader-scroll-to-top-pill.md)、[DMARC 对齐与三段式安全警示横幅](TASK-20261124-008-security-banner-and-dmarc.md)及[全站中英双语国际化](TASK-20261124-009-bilingual-i18n.md)。
- 构建命令：`task package:windows:beta VERSION=v0.0.1.beta.9`（内部执行 `powershell -NoProfile -ExecutionPolicy Bypass -File ./desktop/build/windows/package-windows.ps1 -Version "v0.0.1.beta.9"`）。Wails 绑定生成、TypeScript 校验、Vite 生产压缩构建、Go `windows/amd64` 编译与 NSIS `/WX` 零警告打包全部通过。
- 安装包：`dist/release/v0.0.1.beta.9/OmniMail-Setup-v0.0.1.beta.9-windows-amd64.exe`（6,938,057 字节，约 6.62 MB）。产品版本 `v0.0.1.beta.9`，PE 数字版本 `0.0.1.9`。
- SHA-256：`50b19ff1e2ac6c8d5bcf6dd821dbfe503dccc221862e19c7875ac76c5c12f011`，与同目录 `SHA256SUMS.txt` 完全一致。
- 未重跑测试，未自动安装或启动应用，未推送远程或创建 GitHub Release。
