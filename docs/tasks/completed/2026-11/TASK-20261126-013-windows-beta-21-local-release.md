# TASK-20261126-013 · 构建 Beta v0.0.1.beta.21 本地更新包

- 状态：Completed
- 范围：分别提交轻量化标签交互重构（`TASK-20261126-011`）与顶栏同步胶囊卡死「正在同步…」状态机修复（`TASK-20261126-012`），并在当前分支构建 Windows x64 Beta `v0.0.1.beta.21` 生产安装包供本地更新。
- 方案：沿用 NSIS 生产构建流水线，生成独立版本目录 `dist/release/v0.0.1.beta.21/`，不推送远程仓库、不创建远程 Release。
- 验证计划：在全量 `task verify` 通过并拆分提交实现后，执行 `task package:windows:beta VERSION=v0.0.1.beta.21`，核对安装包版本元数据、文件大小与 SHA-256 摘要。

## 构建结果

- 实现提交（分支 `codex/reader-toolbar-overlap`）：
  - `6a443d28eaa0177badc74dcc3ba5ecc6e80f96e2`：[标签管理轻量化交互重构（贴标签轻浮层、右键级联子菜单与侧边栏原地管理）](TASK-20261126-011-lightweight-label-popovers.md)；
  - `59d143d4489cb5c06559afeb02fce4b49d0da2db`：[修复后台同步或单账户同步后顶栏胶囊卡死「正在同步…」与手动刷新锁死](TASK-20261126-012-fix-sync-chip-stuck-syncing.md)。
- 构建命令：`task package:windows:beta VERSION=v0.0.1.beta.21`（内部执行 `powershell -NoProfile -ExecutionPolicy Bypass -File ./desktop/build/windows/package-windows.ps1 -Version "v0.0.1.beta.21"`）。Wails 绑定生成、TypeScript 校验、Vite 生产压缩构建、Go `windows/amd64` 编译与 NSIS 零警告打包全部通过。
- 安装包：`dist/release/v0.0.1.beta.21/OmniMail-Setup-v0.0.1.beta.21-windows-amd64.exe`（7,683,803 字节，约 7.33 MB）。产品版本 `v0.0.1.beta.21`，PE 数字版本 `0.0.1.21`。
- SHA-256：`967032d0dd77e1c80209b76add26004574222bdab973007b6c2131d72ca33995`，与同目录 `SHA256SUMS.txt` 完全一致。
- 未自动安装或启动应用，未推送远程或创建 GitHub Release。
