# TASK-20261126-005 · 构建 Beta v0.0.1.beta.18 本地更新包

- 状态：Completed
- 范围：提交关于页重构与静默自动更新闭环（`TASK-20261126-004`），并在当前分支构建 Windows x64 Beta `v0.0.1.beta.18` 生产安装包供本地更新。
- 方案：沿用 NSIS 生产构建流水线，生成独立版本目录 `dist/release/v0.0.1.beta.18/`，不推送远程仓库、不创建远程 Release。
- 验证计划：在全量 `task verify` 通过并提交实现后，执行 `task package:windows:beta VERSION=v0.0.1.beta.18`，核对安装包版本元数据、文件大小与 SHA-256 摘要。

## 构建结果

- 实现提交：`63797d6a5c6b8c070577e83b4bf9167b378d6ee9`（`codex/reader-toolbar-overlap`），包含：
  - [关于页重构与静默自动更新闭环](TASK-20261126-004-about-and-silent-auto-updater.md)（NSIS `/RELAUNCH` 静默自动重启、Go 双通道 GitHub Release 检测与真实错误上报、受信任 HTTPS 流式下载与 `SHA256SUMS.txt` 强校验、首页顶栏四档响应式更新胶囊与视口钳位悬浮卡、三卡片重构后的「设置 → 关于 OmniMail」及废弃验收横幅预览卡片清理）。
- 构建命令：`task package:windows:beta VERSION=v0.0.1.beta.18`（内部执行 `powershell -NoProfile -ExecutionPolicy Bypass -File ./desktop/build/windows/package-windows.ps1 -Version "v0.0.1.beta.18"`）。Wails 绑定生成、TypeScript 校验、Vite 生产压缩构建、Go `windows/amd64` 编译与 NSIS `/WX` 零警告打包全部通过。
- 安装包：`dist/release/v0.0.1.beta.18/OmniMail-Setup-v0.0.1.beta.18-windows-amd64.exe`（7,615,116 字节，约 7.26 MB）。产品版本 `v0.0.1.beta.18`，PE 数字版本 `0.0.1.18`。
- SHA-256：`c7f55d5a98819b38912f180e9d2c9c4c50aa5f6892f02032d73db80f8babdf6e`，与同目录 `SHA256SUMS.txt` 完全一致。
- 未自动安装或启动应用，未推送远程或创建 GitHub Release。
