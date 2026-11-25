# TASK-20261125-010 · 构建 Beta v0.0.1.beta.14 本地更新包

- 状态：Completed
- 范围：提交本轮三项核心迭代（`AddAccountModal` 统一双栏选型弹窗、`QuickReplyHeader` 发件身份胶囊三级自适应降级与 `Tooltip`、`TopBarSyncChip` + `SyncStatusPopover` + 侧边栏单账号原位异常提示及 Go IMAP 建连瞬时断连静默退避重试），并在当前分支构建 Windows x64 Beta 生产安装包供本地更新。
- 方案：沿用 NSIS 生产构建流水线，生成独立版本目录 `dist/release/v0.0.1.beta.14/`，不推送远程仓库、不创建远程 Release。
- 验证计划：在全量 `task verify` 通过并提交实现后，执行 `task package:windows:beta VERSION=v0.0.1.beta.14`，核对安装包版本元数据、文件大小与 SHA-256 摘要。

## 构建结果

- 实现提交：`72b975cf3bcfa8ac4fdbc90521b634363a109ff2`（`codex/reader-toolbar-overlap`），包含：
  - [统一双栏「添加邮箱账户」选型弹窗](TASK-20261125-007-unified-add-account-modal.md)
  - [快速回复发件邮箱自适应三级降级](TASK-20261125-008-quick-reply-adaptive-pill.md)
  - [部分账户同步受阻 · 顶栏状态胶囊、同步浮层与瞬时断连重试](TASK-20261125-009-sync-status-popover.md)
- 构建命令：`task package:windows:beta VERSION=v0.0.1.beta.14`（内部执行 `powershell -NoProfile -ExecutionPolicy Bypass -File ./desktop/build/windows/package-windows.ps1 -Version "v0.0.1.beta.14"`）。Wails 绑定生成、TypeScript 校验、Vite 生产压缩构建、Go `windows/amd64` 编译与 NSIS `/WX` 零警告打包全部通过。
- 安装包：`dist/release/v0.0.1.beta.14/OmniMail-Setup-v0.0.1.beta.14-windows-amd64.exe`（7,540,381 字节，约 7.19 MB）。产品版本 `v0.0.1.beta.14`，PE 数字版本 `0.0.1.14`。
- SHA-256：`ddda670e2825181e1b4f97deb11879b7ea8332d699c6e6ae8662d943dfa3c911`，与同目录 `SHA256SUMS.txt` 完全一致。
- 未自动安装或启动应用，未推送远程或创建 GitHub Release。
