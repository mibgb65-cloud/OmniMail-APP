# TASK-20261125-008 优化快速回复发件邮箱自适应显示与三级降级

- **状态**：Completed
- **创建日期**：2026-11-25
- **完成日期**：2026-11-25
- **实现提交**：`72b975cf3bcfa8ac4fdbc90521b634363a109ff2`（`codex/reader-toolbar-overlap`）

## 原始需求与范围

对照 `OmniMail-redesign.fig` -> `16 · 写信表单细节` -> `快速回复 · 发件邮箱自适应显示规范（亮 / 暗双色）`（Node ID: `1859607977:2558`），重构 `QuickReplyBox` 顶部发件账号锁定胶囊：

1. **文案结构拆分与无冗余尾部“发送”**：
   - 将原单段 `sendViaText` 拆分为可选前缀（中文 `通过 {providerLabel} · ` / 英文 `Via {providerLabel} · `，空值回退 `account.name` 或默认账户文案）与最高优先级保留的具体邮箱 `account.email`（为空时回退 `account.name`）。
   - 胶囊内部结构对齐设计稿：`[ProviderIcon size={15} bare]` + `[可选前缀 span]` + `[具体邮箱 span]` + `[Icon name="lock" size={11}]`，去除多余尾部「发送」。
   - 收起态 `quickReplyCollapsedHeader` 同样优先使用 `account.email`，不再重复拼接 `name · providerLabel`。
2. **移除 `240px / 260px` 硬编码截断，实现 3 级自适应渐进降级**：
   - 清理 `mail-reader-extras.css`（`max-width: 240px`）与 `i18n-layout.css`（`max-width: min(260px, 58%)`）。
   - 新增 `useQuickReplyPillLayout.ts` 与 `QuickReplyHeader.tsx`：通过 `ResizeObserver` 监听顶部栏真实宽度，结合离屏隐藏测量容器测量左侧标题自然宽度、完整胶囊宽度与纯邮箱胶囊宽度（带 `6px` 临界迟滞防抖，零测量环路与闪烁）：
     - **状态 01（宽裕态 `full`）**：完整展示 `[图标] 通过 {providerLabel} · {email} [🔒]`，左侧标题至少保留 `96px` 可读空间；
     - **状态 02（较挤态 `email-only`）**：自动隐藏前缀 `通过 {providerLabel} · `，完整展示 `[图标] {email} [🔒]`；
     - **状态 03（极端窄屏兜底 `ellipsis`）**：隐藏前缀并对 `{email}` 单行省略，两侧品牌图标与锁标保持 `flex-shrink: 0` 不被挤压。
3. **完整身份 Tooltip**：
   - 使用 `<Tooltip label={tooltipText} placement="top">` 包裹锁定胶囊，无论处于哪一级降级状态，悬停与聚焦始终展示 `已锁定原收件账户 · 通过 {providerLabel} · {email}`（英文 `Locked to original account · Via {providerLabel} · {email}`）及无障碍 `aria-label`。
4. **单文件 `<= 200` 行与单测覆盖**：更新中英词典与内置中文服务商名英文归一化，新增 `tests/quick-reply-pill.test.mjs` 覆盖 3 级宽度态与双语文案。

## 落地变更摘要

- [QuickReplyBox.tsx](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/components/mail/reader/QuickReplyBox.tsx)：拆出顶部栏组件，保持主体状态与附件/回复发送逻辑聚焦（141 行）。
- [QuickReplyHeader.tsx](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/components/mail/reader/QuickReplyHeader.tsx)：渲染展开/收起态头部、离屏宽度测量宿主、三级渐进降级锁定胶囊与完整身份 `Tooltip`（153 行）。
- [useQuickReplyPillLayout.ts](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/components/mail/reader/useQuickReplyPillLayout.ts)：实现 `resolveQuickReplyIdentity`、`evaluateQuickReplyPillStage`（含 `6px` 迟滞余量防抖）与 `ResizeObserver` 响应式测量 Hook（156 行）。
- [mail-reader-extras.css](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/styles/mail-reader-extras.css) & [i18n-layout.css](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/styles/i18n-layout.css)：彻底移除 `max-width: 240px` 与 `max-width: min(260px, 58%)` 硬编码限制，补充 `.quick-reply-header*`、`.quick-reply-pill-prefix`、`.quick-reply-pill-email` 与 `.quick-reply-measure-host` 布局样式。
- [mailAndSecurity.ts (zh)](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/i18n/zh/mailAndSecurity.ts)、[mailAndSecurity.ts (en)](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/i18n/en/mailAndSecurity.ts) & [normalizers.ts](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/src/i18n/normalizers.ts)：更新 `quickReplyViaPrefix`、`quickReplyLockTooltip`、`quickReplyCollapsedHeader` 与内置中文服务商英文映射。
- [quick-reply-pill.test.mjs](file:///e:/go/new/wails3-v/newui/OmniMail-APP/desktop/frontend/tests/quick-reply-pill.test.mjs)：覆盖中英双语身份拼装与回退、3 级宽度自适应降级与临界防抖迟滞、样式硬编码上限清理及 `Tooltip` / `bare` 图标断言。

## 验证结果

- `task format`：通过。
- 全仓手写源码单文件 `<= 200` 行检查：通过。
- `npm test`：92 / 92 单元测试全部通过（含新增 `quick-reply-pill.test.mjs` 3 项子测试）。
- `npm run build` & `task verify`：`eslint`、`tsc --noEmit`、`vite build`、`go vet ./...`、`go test ./...` 与 `go build` 全绿通过。
