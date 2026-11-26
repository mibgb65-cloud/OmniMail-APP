# TASK-20261126-019 · 构建 Beta v0.0.1.beta.23 本地更新包

- 状态：Completed
- 范围：分别提交图片大图预览器重构（`TASK-20261126-017`）与左侧边栏及嵌套滚动区滚动条对齐修复（`TASK-20261126-018`），并在当前分支构建 Windows x64 Beta `v0.0.1.beta.23` 生产安装包供本地更新。
- 方案：沿用 NSIS 生产构建流水线，生成独立版本目录 `dist/release/v0.0.1.beta.23/`，不推送远程仓库、不创建远程 Release。
- 验证计划：在全量 `task verify` 通过并拆分提交实现后，执行 `task package:windows:beta VERSION=v0.0.1.beta.23`，核对安装包版本元数据、文件大小与 SHA-256 摘要。

## 构建结果

- 实现提交（分支 `codex/reader-toolbar-overlap`）：
  - `8eee9ffefc1c489049172294a9a8c77b4882b06f`：[重构图片大图预览器（ImageLightbox 智能透明底板、悬浮胶囊去重与三段式阻尼动效）](TASK-20261126-017-image-lightbox-refinement.md)；
  - `d8a3b971aba522611bf049fa29b1ed4902b34a8d`：[修复左侧边栏及嵌套滚动区滚动条压盖卡片边框与操作项错位](TASK-20261126-018-sidebar-scrollbar-alignment.md)。
- 构建命令：`task package:windows:beta VERSION=v0.0.1.beta.23`（内部执行 `powershell -NoProfile -ExecutionPolicy Bypass -File ./desktop/build/windows/package-windows.ps1 -Version "v0.0.1.beta.23"`）。Wails 绑定生成、TypeScript 校验、Vite 生产压缩构建、Go `windows/amd64` 编译与 NSIS 零警告打包全部通过。
- 安装包：`dist/release/v0.0.1.beta.23/OmniMail-Setup-v0.0.1.beta.23-windows-amd64.exe`（7,688,929 字节，约 7.33 MB）。产品版本 `v0.0.1.beta.23`，PE 数字版本 `0.0.1.23`。
- SHA-256：`7b6ac63b539a627fef76fe8ef10968eb25c6abef9cf3b59fc895077b19787f1c`，与同目录 `SHA256SUMS.txt` 完全一致。
- 未自动安装或启动应用，未推送远程或创建 GitHub Release。
