# TASK-20261124-016: 邮件内嵌 cid 图片全兼容修复与统一大图 Lightbox 预览

## 状态
已完成并验证通过（2026-11-24）。

## 完成内容
1. **后端 `cid:` 内嵌图全兼容与存量兜底修复**：
   - 更新 `desktop/internal/syncer/store_ingest_helpers.go` 与 `store_ingest.go`：只要附件存在 `ContentID` 即标准化写入 `cidMap`（去除 `<>`、URL 解码、小写化），不再强要求 `a.IsInline == true`；若该 `cid` 被 HTML 正文引用，则同步归类为内嵌资源避免底部普通附件栏重复展示（无 HTML 正文时保留展示）。
   - 更新 `desktop/internal/security/html_sanitizer.go`：支持大小写、尖括号与 URL 转义 `cid:` 查表，命中重写为 `src="/omnimail-cid/{attID}" data-omnimail-cid="{attID}"`，未命中保留 `data-omnimail-cid-missing="1"`；安全放行 `<= 2MB` 的栅格 `data:image/(png|jpeg|jpg|gif|webp);base64,`，严格拦截 `image/svg+xml` 与超大载荷；修复含尖括号属性值时正则提前截断的问题。
   - 新增 `desktop/internal/search/detail_cid.go` 并更新 `detail.go`、`desktop/asset_stream.go`：兼容存量邮件读取时的 `cid:` / `data-omnimail-cid` 补齐与 `content_id` 回退查询；新增 `desktop/services/mail_image_save.go`（`MailService.SaveImageDataAs`）供 Lightbox 另存任意原图。
   - 补充 Go 单元测试 `html_sanitizer_test.go` 与 `store_ingest_cid_test.go`。
2. **正文图片悬停态、失败兜底与点击收集**：
   - 新增 `mailImageGallery.ts` 与 `safeMailHtmlImages.ts`，升级 `SafeMailHtmlView.tsx`、`safeMailHtmlStyles.ts`、`useReaderLinkHandlers.ts`、`ReaderThreadCard.tsx`、`ReaderAttachmentsSection.tsx`、`AttachmentCardRow.tsx`、`MailReaderPane.tsx`：
     - 对自然尺寸 `>= 48×48` 且不在 `<a href>` 内的图片自动标记 `data-zoomable="true"`，附加 `cursor: zoom-in` 与悬停高亮边框；被链接包裹的图片优先触发外链安全确认。
     - 监听 `error` 事件及 `data-omnimail-cid-missing="1"` 节点，以亮/暗双色适配的内联占位卡片替代原生裂图，支持点击「重试」按需拉取 `DownloadAttachment` 并重载图片。
     - 自动合并当前邮件正文大图与图片附件并去重，统一唤起 Lightbox。
3. **沉浸式图片 Lightbox 组件**：
   - 在 `types/ui.ts` 与 `OverlayRouter.tsx` 新增 `{ type: "image-lightbox", images, initialIndex }` 浮层，接管正文图片与图片附件的大图预览。
   - 新增 `lightbox/` 模块（`ImageLightboxModal.tsx`、`ImageLightboxTopbar.tsx`、`ImageLightboxControls.tsx`、`useLightboxViewport.ts`、`useLightboxActions.ts`、`lightboxActions.ts`）与样式 `image-lightbox.css`、`image-lightbox-controls.css` 及中英双语 i18n（`zh/imageLightbox.ts`、`en/imageLightbox.ts`）：
     - 支持顶部信息与尺寸序号胶囊、另存为、左右切换箭头、以指针为中心的滚轮缩放（`25%–400%`）、放大拖拽平移、双击切换适应/100%、底部悬浮控制胶囊（缩小/缩放比/放大/适应窗口/顺时针 90° 旋转/复制图片/保存原图）、多图缩略条与全套键盘快捷键（`←/→`、`+/-`、`0`、`R`、`Esc`），遵守 `prefers-reduced-motion`。
   - 补充前端单元测试 `mail-image-gallery.test.mjs`。

## 验证结果
- 全部新增与修改源码文件严格控制在 200 行以内。
- `task verify` 全量通过：`bindings`、`gofmt`、`prettier --check`、`eslint`（0 error / 0 warning）、`tsc --noEmit`、`vite build`、`pnpm test`（72/72 通过）、`go vet`、`go test ./...`、`go build`。
