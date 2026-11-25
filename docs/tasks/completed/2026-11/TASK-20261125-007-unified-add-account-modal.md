# TASK-20261125-007 重构添加邮箱账户统一双栏选型弹窗

- **状态**：Completed
- **创建日期**：2026-11-25
- **完成日期**：2026-11-25
- **实现提交**：`72b975cf3bcfa8ac4fdbc90521b634363a109ff2`（`codex/reader-toolbar-overlap`）

## 原始需求与范围

对照 `OmniMail-redesign.fig` -> `09 · 邮箱接入指引` 下的 `添加邮箱 · 统一双栏选型 · 亮色 / 暗色`（Node ID: `1859607977:515` / `1859607977:751`），重构 `AddAccountModal`，使其与后续接入弹窗（`ProviderConnectShell`）保持完全一致的 `980 × 760` 尺寸与亮暗视觉规范，消除切换跳动，并支持「AI Agent 邮箱」分类筛选与快速搜索。

## 实际改动

1. **统一 `980 × 760` 弹窗骨架与零跳动平滑转场**：
   - 更新 `provider-connect-modal.css`、`provider-connect-extras.css` 与 `ModalShell.tsx`，令 `AddAccountModal` 与 `ProviderConnectShell` 统一使用 `.modal-card.pcm-modal-card`（`width: min(980px, calc(100vw - 40px))`、`height: min(760px, calc(100vh - 36px))`、`64px` 顶底栏与亮/暗双色 token）。
   - 更新 `OverlayRouter.tsx`，将 `add-account` 与各接入指引模态框归入同一 `connect-suite` 容器，保持外层遮罩与 `980 × 760` 外框稳定不重绘，仅对内部内容执行 `160ms ease-out` 方向性微移淡入过渡（支持 `prefers-reduced-motion`）。
2. **服务商分类模型与双语预设**：
   - 在 `types/account.ts` 新增 `ProviderCategory = "agent" | "standard"` 与可选 `category?: ProviderCategory`（旧结构默认回退 `"standard"`）。
   - 新增 `data/providersAgent.ts`（`WorkBuddy Agent 邮箱`、`Muse Mail`）与 `i18n/providerCatalogEnAgent.ts`，在 `data/providers.ts` 暴露 `mergePickerPresets`、`ALL_PROVIDER_PRESETS` 与 `resolveProviderCategory`。
3. **双栏选型界面与样式拆分（均 `<= 200` 行）**：
   - 新增 `addAccountCatalog.ts`、`AddAccountModal.tsx`、`AddAccountSidebar.tsx`、`AddAccountDirectory.tsx`、`AddAccountCards.tsx` 以及 `add-account-modal.css`、`add-account-directory.css`、`add-account-cards.css`。
   - 新增中英双语词典 `i18n/zh/addAccountPicker.ts` 与 `i18n/en/addAccountPicker.ts`。
   - 支持左栏 `228px` 分类切换、支持接入方式标签组、底部手动 IMAP/SMTP 快捷卡与本地加密脚注；右栏 `FadeScroll` 支持即时搜索过滤、AI Agent / 传统分组展示、奇数项「其他自定义邮箱」自动补位、搜索空态快捷恢复，以及 `< 760px` 窄屏响应式降级。
4. **测试与文档更新**：
   - 新增 `desktop/frontend/tests/add-account-modal.test.mjs`，更新 `docs/plans/CURRENT.md`。

## 验证结果

- `npm run build` & `npm test`：TypeScript 类型检查、Vite 构建及 89/89 项前端单元测试全部通过。
- `task verify`：ESLint、格式检查、`go vet`、前后端单测、开发程序构建及全仓手写源码 `<= 200` 行检查全部通过。

## 未验证事项

- 未自动启动桌面客户端进行人工点击巡检（由组件与纯逻辑单测及构建门禁覆盖）。
