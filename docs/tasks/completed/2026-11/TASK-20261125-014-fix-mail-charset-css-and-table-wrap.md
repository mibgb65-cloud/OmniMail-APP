# TASK-20261125-014 · 修复邮件头裸 GB18030 解码、安全样式保留与表格列头换行，并平滑修复存量邮件

- 状态：Completed
- 范围：
  1. 修复非 RFC 2047 裸 GBK/GB18030 邮件头乱码、未加引号特殊显示名紧贴尖括号地址拆分失败，以及由此触发的「高危钓鱼或欺诈邮件预警」误报。
  2. 在防 XSS 与防外链追踪前提下，安全保留响应式 HTML 邮件自带的 `<style>` 样式块与 `class`/`id` 属性，修复网易登录提醒等多端隐藏按钮重叠问题。
  3. 移除 Shadow DOM `:host` 全局 `word-break: break-word`，恢复 GitHub Actions 等表格列头（如 `Status`）横向单行排版。
  4. 提供幂等本地存量修复（Migration v5 + 详情读取按需恢复），无需删号重拉即可自动修复历史邮件、联系人与 `.eml.zst` 样式。

## 实现摘要

- **裸非 UTF-8 头字节兜底解码与容错地址提取**：
  - `desktop/internal/mailproto/charset.go`：新增 `EnsureUTF8HeaderBytes` 与 `DecodeHeaderTextWithHint`，按同邮件头提示编码（如 `gb18030`/`gbk`/`big5`）优先解码，无提示时回退 `GB18030` 再回退 UTF-8 替换符。
  - `desktop/internal/mailproto/header_addr.go` & `mime_parser.go`：直接从展开后的原始头块提取 `From`/`To`/`Cc`/`Reply-To`，标准 `net/mail.ParseAddressList` 失败时通过容错拆分提取显示名与最后一个合法 `<user@domain>` 或裸邮箱，确保 `Email` 始终为去除尖括号的小写纯邮箱。
  - `desktop/internal/security/phishing.go` & `phishing_helpers.go`：`emailDomain` 防御性提取尖括号内地址并校验纯域名语法，避免异常头格式触发显示名伪装误报。
- **白名单 CSS 清洗器与响应式 `<style>` / `class` 保留**：
  - `desktop/internal/security/css_sanitizer.go`、`css_sanitizer_rules.go` & `html_sanitizer.go`：新增 `SanitizeMailCSS`，剥离注释与 `</style` 标签闭合逃逸，拦截 `@import`/`@charset`/`@namespace`、外部 `url(...)`（置 `hasRemoteImages = true` 并替换为 `none`）、`expression(`、`javascript:`、`vbscript:`、`behavior`、`-moz-binding`，将 `position: fixed` 降级为 `static`，将 `html`/`body` 选择器重写到 `.mail-html-inner`；`bluemonday` 放行安全 `class`/`id` 与表格 `scope`/`colspan`/`rowspan`。
- **Shadow DOM 表格列头换行与深色自适应兼容**：
  - `desktop/frontend/src/components/mail/reader/safeMailHtmlStyles.ts` & `SafeMailHtmlView.tsx`：`:host` 改为 `overflow-wrap: break-word; word-break: normal;`，`table, th, td` 显式设为 `word-break: normal; overflow-wrap: normal;`；主题样式节点后置于 `.mail-html-inner`，确保暗色自适应底色与白字品牌按钮对比度正常。
- **本地存量邮件与联系人平滑兼容修复**：
  - `desktop/internal/mailrepair/`（`repair.go`、`repair_contacts_html.go`、`repair_html.go`）、`profilemgr/manager.go`、`search/detail.go` & `detail_cid.go`：引入 `schema_migrations` 版本 `5` 幂等修复与详情读取按需重建，自动修正历史乱码邮件头、`messages_fts`、误报 `security_json`、畸形 `contacts` 行，并从本地 `blobs/raw/<sha256>.eml.zst` 重新运行 `SanitizeMailHTML` 恢复 `<style>` 与 `class`（保持 CID 内嵌图映射与外链图片默认拦截策略不变）。

## 验证结果

- 单文件行数门禁：所有修改及新增源码文件均严格 `<= 200` 行。
- 新增与更新单测：`desktop/internal/mailproto/header_charset_test.go`、`desktop/internal/security/css_sanitizer_test.go`、`desktop/internal/mailrepair/repair_test.go`、`desktop/frontend/tests/linkify-plain-text.test.mjs`。
- 全量门禁：`go test -v ./internal/mailproto/... ./internal/security/... ./internal/mailrepair/... ./internal/storage/... ./internal/search/...`、前端单测（`96/96` 通过）、`task verify` 与 `task build` 全部零错误通过。
- 未验证事项：未自动启动桌面窗口，未推送远程仓库。
- 实现已提交：`9406b576349861d681723b5a721aa0654378bf56`，纳入 [Beta 16 本地安装包](TASK-20261125-015-windows-beta-16-local-release.md)。
