# TASK-20261124-011 · 邮件正文外链跳转安全确认弹窗与域名白名单

- 状态：Completed
- 当前行为：`SafeMailHtmlView.tsx` 点击 `http(s)://` 链接时直接调用 `openSafeExternalUrl(href)` 打开系统默认浏览器，缺少域名核验、伪装/Punycode/非加密 HTTP/高危钓鱼邮件二次确认与按 Profile 隔离的受信任域名白名单管理；纯文本正文段落未将 `http(s)://` 链接接入统一外链守卫。
- 方案：新增外链风险判定与白名单守卫模块、统一 HTML 与纯文本邮件正文外链拦截入口、按 OpenPencil `20 · 邮件安全、源码与日程 / 外链跳转安全确认弹窗 · 亮暗双色与高危警示规范` 实现亮暗双色/中英双语弹窗，并在「设置 → 隐私与安全」提供受信任域名清空入口。

## 实现与验证

- **外链风控与按 Profile 隔离白名单**：新增 `desktop/frontend/src/components/mail/reader/externalLinkGuard.ts` 与 `trustedLinkDomains.ts`，严格仅放行 `http:` / `https:` 协议（拒绝 `javascript:` / `data:` / `file:` 等），判定 `spoofed-text`（主域伪装）、`punycode`（`xn--`）、`mail-danger`（高危钓鱼邮件）为 `danger`，判定 `ip-address` 与 `insecure-http` 为 `warning`；提供 `isDomainTrusted` / `trustDomain` / `removeTrustedDomain` / `clearTrustedDomains` / `listTrustedDomains`，并在 `canBypassExternalLinkConfirm` 中强制执行安全红线（高危或非安全链接无视白名单拦截且不提供信任勾选）。
- **正文点击统一拦截**：改造 `SafeMailHtmlView.tsx` 新增 `onExternalLink` 回调（保留 `mailto:` 逻辑）；新增 `PlainTextParagraph.tsx` 与 `useReaderLinkHandlers.ts` 接入 `ReaderThreadCard.tsx`，使 HTML 正文与纯文本段落中的 `http(s)://` 链接统一走白名单直通或触发 `external-link` 弹窗。
- **弹窗 UI、全局 Overlay 与隐私设置联动**：扩展 `types/ui.ts`（`OverlayModal`）与 `OverlayRouter.tsx`，扩展 `ModalShell.tsx` 支持 `cardClassName` / `ariaLabel`；新建 `ExternalLinkConfirmModal.tsx`、`ExternalLinkModalBody.tsx`、`styles/external-link-tokens.css` 与 `styles/external-link-modal.css`（1:1 对齐 OpenPencil 亮暗双色常规态与高危警示态规范，高危态隐藏自绘 `Checkbox` 并默认聚焦「取消并返回」）；在 `PrivacyTab.tsx` 新增已信任外链域名计数与「清空信任列表」操作；新增 `i18n/{zh,en}/externalLink.ts` 并接入 `zhCN.ts` / `enUS.ts`。
- **源码行数核验**：所有新增与修改的前端源码文件均严格控制在 `<= 200` 行内。
- **验证结果**：新增单测 `desktop/frontend/tests/external-link-guard.test.mjs`；执行全量 `task verify` 通过（`gofmt` / `prettier --check` / `eslint` / `tsc --noEmit` / `vite build` / 49 项前端单测全部通过 / `go vet` / `go test` / `go build`）。
- **未验证事项**：按协作规则未启动原生桌面窗口人工预览，未做发布包，未创建 Git 提交。
- 实现已提交：`faaabeb353443b9607538110bb4f7e39ca1b2083`，纳入 [Beta 10 本地安装包](TASK-20261124-019-windows-beta-10-local-release.md)。
