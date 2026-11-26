# TASK-20261126-006 · 修复邮件阅读器主题配色冲突、追踪像素误报错与会话重复渲染

- 状态：Completed
- 范围：
  1. 剥离顶层 HTML 注释与 Outlook MSO 条件注释后再抽取 `<style>`，解耦邮件自带 `@media (prefers-color-scheme: dark|light)` 与系统主题匹配，自动改写限定到 `.mail-html-inner[data-theme=...][data-html-mode=...]` 作用域，兼容 `mail.db` 已入库存量邮件并显式声明亮色 `color-scheme: light`；
  2. 静默隐藏 `1×1` 追踪像素与显式隐藏信标图片（不弹 `.omnimail-img-fallback` 卡片、不进入大图预览画廊），并区分「内嵌图片暂未缓存或加载失败」与「远程图片加载失败」文案；
  3. 修复 Gmail `[Gmail]/All Mail`（`archive`）与 `inbox` 同封邮件在 `GetMessageItem` 会话列表中重复渲染 2 张卡片的问题，按规范化 `rfc_message_id` / `raw_blob_sha256` 稳定去重并保留最优记录。

## 实际改动

- **CSS 配色解耦、MSO 条件注释剥离与存量平滑兼容**：
  - `desktop/internal/security/{css_sanitizer,css_sanitizer_rules,css_color_scheme,html_comments}.go`：提取 `<style>` 前剥离 `<!--[if mso]>...<![endif]-->` 与 HTML 注释；将 `@media (prefers-color-scheme: dark|light)` 剥离系统查询并合并/限定到 `.mail-html-inner[data-theme="dark"][data-html-mode="adaptive"]` 或亮色/`paper` 作用域，杜绝 `.mail-html-inner` 自嵌套。
  - `desktop/internal/search/{detail,detail_cid}.go` 与 `desktop/frontend/src/components/mail/reader/{SafeMailHtmlView.tsx,safeMailHtmlColorScheme.ts,safeMailHtmlStyles.ts}`：读取存量记录与注入 Shadow DOM 时双层兜底改写残留 `prefers-color-scheme`，并在 `theme === "light"` 时显式返回 `:host, .mail-html-inner { color-scheme: light; }`。
- **隐形追踪像素静默收起与远程/内嵌图片失败文案分离**：
  - `desktop/frontend/src/components/mail/reader/{trackingPixelGuard,safeMailHtmlImages,mailImageGallery}.ts` 与 `src/i18n/{zh,en}/imageLightbox.ts`：识别 `hidden`、`display:none`、`<=3px` 极小尺寸及无 `alt` 打开统计信标并静默收起、排除出画廊；区分缺失 `cid:` 内嵌图与 `http/https` 远程图片失败提示，未放行外链图（仅含 `data-omnimail-src`）不弹报错卡。
- **Gmail `All Mail` / `INBOX` 会话同邮件稳定去重**：
  - `desktop/internal/search/{detail,detail_dedup}.go`：补查 `folder`、`rfc_message_id`、`raw_blob_sha256`，按 `当前打开 msgID > 非 archive 文件夹 > 内容完整度` 稳定去重并保持时间升序及末条展开。
- **单元测试**：`desktop/internal/security/css_sanitizer_test.go`、`desktop/internal/search/detail_thread_test.go`、`desktop/frontend/tests/{safe-mail-html-reader,mail-image-gallery,linkify-plain-text}.test.mjs`。

## 验证结果

- `go test ./internal/security/... ./internal/search/...` 与全量 `task verify`（Prettier、ESLint、`tsc --noEmit`、前端 109 项测试、Go 全包 `go vet` + `go test ./...`）全部通过，所有手写源码与测试文件均 `<= 200` 行。
