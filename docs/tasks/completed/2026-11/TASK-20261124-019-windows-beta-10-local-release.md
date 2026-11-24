# TASK-20261124-019 · 构建 Beta v0.0.1.beta.10 本地更新包

- 状态：Completed
- 范围：提交外链跳转安全确认与受信任域名白名单、邮件列表两级无缝续拉与历史回溯、切换邮箱/文件夹骨架屏与入场动效、暗黑模式 HTML 深色适配/原始白底切换与纯文本自动链接识别、写信富文本编辑器与剪贴板内嵌图及弹窗级拖拽附件、`cid:` 内嵌图全兼容与沉浸式图片 Lightbox 预览、QQ 邮箱增量同步容错重连与连接诊断增强、以及全局 `FadeScroll` 自定义悬浮滚动条实现；在当前分支构建 Windows x64 Beta 生产安装包供本地更新。
- 方案：沿用现有 NSIS 生产构建链路，生成独立版本目录 `dist/release/v0.0.1.beta.10/`，不推送、不创建远程发布。
- 验证计划：按用户要求不重跑测试；仅执行打包必需的编译与封装步骤，并核对安装包的版本信息、文件大小与 SHA-256。

## 构建结果

- 实现提交：`faaabeb353443b9607538110bb4f7e39ca1b2083`（`codex/reader-toolbar-overlap`），含[外链跳转安全确认弹窗](TASK-20261124-011-external-link-guard.md)、[邮件列表两级无缝续拉与历史回溯](TASK-20261124-012-mail-list-infinite-backfill.md)、[列表骨架屏与入场动效](TASK-20261124-013-mail-list-skeleton-loading.md)、[暗黑 HTML 双模式与纯文本链接识别](TASK-20261124-014-dark-html-and-linkify.md)、[写信富文本与内嵌图拖拽附件](TASK-20261124-015-compose-rich-editor-and-inline-images.md)、[内嵌 cid 图全兼容与图片 Lightbox](TASK-20261124-016-cid-inline-images-and-lightbox.md)、[QQ 邮箱增量同步容错与连接诊断增强](TASK-20261124-017-qq-imap-incremental-sync-fix.md)及[全局 FadeScroll 悬浮滚动条](TASK-20261124-018-fade-scroll-overlay-scrollbar.md)。
- 构建命令：`task package:windows:beta VERSION=v0.0.1.beta.10`（内部执行 `powershell -NoProfile -ExecutionPolicy Bypass -File ./desktop/build/windows/package-windows.ps1 -Version "v0.0.1.beta.10"`）。Wails 绑定生成、TypeScript 校验、Vite 生产压缩构建、Go `windows/amd64` 编译与 NSIS `/WX` 零警告打包全部通过。
- 安装包：`dist/release/v0.0.1.beta.10/OmniMail-Setup-v0.0.1.beta.10-windows-amd64.exe`（6,990,619 字节，约 6.67 MB）。产品版本 `v0.0.1.beta.10`，PE 数字版本 `0.0.1.10`。
- SHA-256：`3e4fc851d69ddf1e6507aa0d60fd271d9277c9af8817acb86d7c89b241ba74f4`，与同目录 `SHA256SUMS.txt` 完全一致。
- 未重跑测试，未自动安装或启动应用，未推送远程或创建 GitHub Release。
