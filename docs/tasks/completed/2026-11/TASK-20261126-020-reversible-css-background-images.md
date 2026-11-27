# TASK-20261126-020 · 修复邮件 CSS/HTML 远程背景图放行空白并支持存量 `.eml.zst` 按需恢复

- 状态：Completed
- 实现提交：待提交（工作区已通过全量验证）
- 实际改动：
  1. **入库清洗阶段可逆暂存远程背景图**（`desktop/internal/security/html_sanitizer.go`、`desktop/internal/security/html_bg_attrs.go`、`desktop/internal/security/html_img_attrs.go`、`desktop/internal/security/css_sanitizer.go`）：
     - 在 `bluemonday` 邮件白名单中放行全局 `data-omnimail-bg` 属性，并在 `sanitizeRemoteImageURL` 中额外拦截 `()` 与 `\` 防范 CSS 注入；
     - 内联 `style` 中的外链 `url(...)`（支持无引号、单双引号、`&amp;` 实体与 `//` 协议相对 URL）统一替换为 `none`（默认零请求），同时将合法 URL 暂存至当前标签的 `data-omnimail-bg`（自动清除输入中伪造的同名属性）；
     - 兼容老式邮件 HTML `background="https://..."` 属性，提取合法外链至 `data-omnimail-bg` 并标记 `hasRemoteImages = true`；
     - `<style>` 块内的合法外链 `url(...)` 替换为零请求安全注释占位 `none/*omnimail-css-url:<base64>*/`（同时兼容 `RewriteLegacyColorSchemeHTML` 二次经过 `SanitizeMailCSS` 时不丢失占位）；`javascript:` 等非法协议一律销毁为 `none`；
  2. **放行态精准安全还原**（`RestoreRemoteImages`）：二次严格校验 `http`/`https` 合法 URL 后，将元素内联 `style` 中的 `background: none` / `background-image: none` 精准还原为 `url("...")` 并保留原有 `no-repeat center / cover` 等排版属性（无内联 `style` 的老式 `background=` 元素自动补写 `style="background-image: url(\"...\")"`），同步移除 `data-omnimail-bg` 并还原 `<style>` 块中的占位注释；
  3. **已入库存量邮件按需从本地 `.eml.zst` 自动恢复**（`desktop/internal/search/detail_cid.go`、`desktop/internal/mailrepair/repair_html.go`）：放宽 `RebuildMessageHTMLFromBlob` 识别含 `url(` 或 `background=` 的原始 HTML；详情读取时若检测到存量 HTML 含有被抹掉的 `background: none` / `background-image: none` 且无 `data-omnimail-bg` 或 `omnimail-css-url:`，自动触发 `TryLazyRebuildHTML` 从本地 CAS `.eml.zst` 重建更新入库并完成背景图放行还原，无需用户重新拉取邮件。
- 验证结果：
  - 在 `html_sanitizer_test.go` 与 `repair_test.go` 补充 Instagram 内联背景图、`<style>` 块与 HTML `background=` 属性、`javascript:` 注入拦截以及存量 `.eml.zst` 按需恢复回归单测；
  - 全部变更手写文件均严格 `<= 200` 行，执行 `go test ./internal/security/... ./internal/mailrepair/... ./internal/search/...` 与全仓 `task verify` 全部通过。
