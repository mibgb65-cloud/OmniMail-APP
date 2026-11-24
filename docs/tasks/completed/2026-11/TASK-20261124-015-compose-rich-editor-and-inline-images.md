# TASK-20261124-015: 写信富文本编辑器、剪贴板粘贴内嵌图与弹窗级拖拽附件

## 状态
已完成并验证通过（2026-11-24）。

## 完成内容
1. **后端内嵌图存储与 MIME 组装（Go / SQLite / CAS）**：
   - 新增 SQLite Schema v4 迁移 `desktop/internal/storage/draft_inline_migration.go`（`draft_inline_images` 表与索引），并在 `cas_gc.go` 保护草稿内嵌图引用的 CAS Blob 不被孤儿清理误删；更新 `asset_stream.go` 让 `/omnimail-cid/{id}` 同时兼容草稿内嵌图本地预览。
   - 新增 `desktop/internal/outbox/inline_images.go`、`desktop/services/compose_inline.go` 与 `desktop/desktop_filepick.go`：暴露 `ComposeService.SaveDraftInlineImage`、`SaveDraftInlineImageFromPath`、`SaveDraftAttachmentBytes` 与 `DesktopService.PickLocalImages`，在边界严格校验 MIME 白名单与大小上限（单张内嵌图 `<= 10 MB`，拖拽附件 `<= 25 MB`）。
   - 升级 `desktop/internal/mailproto/mime_builder.go` 与 `mime_inline.go`：按需构建标准 `text/plain`、`multipart/alternative`、`multipart/related`（重写 `/omnimail-cid/{id}` 为 `cid:{contentId}` 并附 `Content-ID` 与 `Content-Disposition: inline`）以及与普通附件混发的 `multipart/mixed`，并在发件队列与草稿预览保留安全清洗后的富文本 HTML。
   - 补充 Go 单元测试 `mime_inline_test.go` 与 `inline_images_test.go`，覆盖纯文本、富文本 `multipart/alternative`、内嵌图 `multipart/related`、混发 `multipart/mixed` 及发送闭环。

2. **前端轻量富文本编辑器、剪贴板粘贴内嵌图与弹窗级拖拽附件（React / TypeScript）**：
   - 新增纯函数工具 `composeRichHtml.ts`（HTML 安全清洗、纯文本提取与 `http/https/mailto` 链接校验）与编辑命令模块 `composeEditorCommands.ts`、`composeEditorClipboard.ts`。
   - 拆分升级 `ComposeToolbar.tsx`、`ComposeToolbarIcons.tsx`、`ComposeLinkPopover.tsx` 与 `useComposePickers.ts`：补齐加粗（`Ctrl+B`）、斜体（`Ctrl+I`）、下划线（`Ctrl+U`）、删除线、无序/有序列表、引用块、行内代码、清除格式、插入超链接（`Ctrl+K` 自定义 Popover）、插入本地图片、添加附件及右侧 AI 写作按钮。
   - 新增受控富文本编辑组件 `ComposeRichEditor.tsx` 与 `useComposeInlineImageSelection.ts`：双轨同步 `draft.body` / `draft.bodyHtml`，拦截粘贴图片落盘 CAS 插入 `<img src="/omnimail-cid/{id}" data-cid="{contentId}" />`，支持点击蓝框选中、右上角删除按钮与 `Backspace`/`Delete` 删除，兼容自动保存、撤回重编、AI 采纳与 `Ctrl+Enter` 快捷发送。
   - 新增弹窗级拖拽上传 `ComposeDropOverlay.tsx` 与 `useComposeDropZone.ts`（`dragDepth` 防闪烁、按住 `Shift` 拖图直接内嵌），并在 `ComposeAttachmentsBar.tsx` 右侧实时显示总容量（`X.X MB / 25 MB`）与超限警示。
   - 新增 `compose-rich-editor.css`、`compose-drop-zone.css` 与中英双语 i18n，补充前端单元测试 `compose-rich-html.test.mjs`。

## 验证结果
- 核查所有新增与修改源码文件，均严格控制在 200 行以内。
- `task verify` 全量通过：`bindings`、`gofmt`、`prettier --check`、`eslint`（0 error / 0 warning）、`tsc --noEmit`、`vite build`、`pnpm test`（68/68 通过）、`go vet`、`go test ./...`、`go build`。
