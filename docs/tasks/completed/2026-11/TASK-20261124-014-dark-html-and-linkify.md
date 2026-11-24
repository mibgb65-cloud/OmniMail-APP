# TASK-20261124-014 · 暗黑模式 HTML 邮件双模式切换与纯文本 URL/邮箱自动识别

- 状态：Completed
- 当前行为：`SafeMailHtmlView.tsx` 在暗黑模式下缺少「深色适配 / 原始白底」切换，且纯文本邮件正文未完整识别 `www.` 链接、邮箱地址与成对括号/标点剥离。
- 方案：在阅读器工具栏翻译按钮右侧新增暗黑模式 HTML 双模式分段切换与外观默认设置持久化，通过独立 Shadow DOM 样式节点无闪烁/不重载图片切换；新增纯函数 `linkifyPlainText.ts` 并在纯文本正文与双语译文段落统一渲染 React 链接节点，接入外链安全确认弹窗与 `mailto:` 写信。

## 实现与验证

- **暗黑模式 HTML 邮件双模式切换与默认偏好**：
  - `types/settings.ts`、`data/settingsDefaults.ts`、`state/storageHelpers.ts`、`state/themeStorage.ts`、`services/profileApi.ts`：新增 `DarkHtmlMode = "adaptive" | "paper"`（默认 `"adaptive"`）本地持久化与后端设置映射保留。
  - `components/settings/AppearanceCard.tsx` 与 `GeneralTab.tsx`：在「设置 → 通用 → 外观与排版」新增「暗黑模式下 HTML 邮件默认视图：深色适配 / 原始白底」开关。
  - `components/mail/reader/HtmlThemeModeToggle.tsx`、`ReaderToolbar.tsx`、`useReaderToolbarActions.ts`、`useReaderToolbarLayout.ts`、`MailReaderPane.tsx`：仅在暗黑模式且当前邮件含 `bodyHtml` 时于翻译按钮右侧渲染 `[深色适配 | 原始白底]` 分段胶囊（浅色模式隐藏、窄屏自动图标折叠并预留工具栏宽度、切换邮件自动重置为默认偏好）。
  - `components/mail/reader/safeMailHtmlStyles.ts` 与 `SafeMailHtmlView.tsx`：新增 `theme` 与 `htmlThemeMode` props；通过独立 `<style class="omnimail-theme-style">` 节点切换 `adaptive`（透明底、`#E2E8F0` 主文字、`#60A5FA` 链接、柔化发件方亮底与极暗字色，并强制 `img/video/svg/canvas` `filter: none !important` 绝不反色）与 `paper`（`#FAFBFD` 柔和白纸容器 + `color-scheme: light`），切换时不重挂载 Shadow DOM、不重载图片、不破坏邮件翻译状态。
- **纯文本 URL 与邮箱自动识别（Linkify）**：
  - 新增 `components/mail/reader/linkifyPlainText.ts`：识别 `http(s)://`、`www.`（自动补全 `https://`）与邮箱地址 `user@domain.tld`，严格剥离末尾中英文标点与未成对右括号（保留成对内部括号如 Wikipedia URL），XSS 文本与非安全协议仅输出纯文本。
  - 更新 `PlainTextParagraph.tsx` 与 `ReaderThreadCard.tsx`：原文段落与双语译文段落均渲染为安全 React 节点（零 `dangerouslySetInnerHTML`），URL 走 `onExternalLink` 安全确认弹窗并带悬停下划线与外链小图标，邮箱走 `onMailto`；样式定义于 `styles/reader-html-theme.css`。
  - 补齐 `i18n/{zh,en}/mailAndSecurity.ts` 与 `i18n/{zh,en}/settingsGeneral.ts` 中英双语词条。
- **源码行数核验**：所有新增与修改的源码文件均严格控制在 `<= 200` 行内。
- **验证结果**：新增单元测试 `desktop/frontend/tests/linkify-plain-text.test.mjs`；全量 `task verify` 通过（`bindings`、`gofmt`、`prettier --check`、`eslint`、`tsc --noEmit`、`vite build`、62 项前端单测、`go vet`、`go test ./...`、`go build`）。
- **未验证事项**：按协作规则未启动原生桌面窗口人工预览，未做发布包，未创建 Git 提交。
- 实现已提交：`faaabeb353443b9607538110bb4f7e39ca1b2083`，纳入 [Beta 10 本地安装包](TASK-20261124-019-windows-beta-10-local-release.md)。
