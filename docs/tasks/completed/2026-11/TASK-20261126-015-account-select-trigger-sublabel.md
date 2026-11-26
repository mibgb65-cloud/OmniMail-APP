# TASK-20261126-015 · 统一全站邮箱账户下拉选择器收起态副标题（真实邮箱地址）展示

- 状态：Completed
- 实现提交：待提交（工作区已通过全量验证）
- 实际改动：
  1. 在 `desktop/frontend/src/utils/accountDisplay.ts` 新增纯函数 `resolveCustomSelectTriggerMeta(current, showSublabelInTrigger)`，并在 `desktop/frontend/src/components/common/CustomSelect.tsx` 接入 `showSublabelInTrigger?: boolean`（默认 `false`）：开启且 `sublabel` 非空且与 `label` 不全等时，触发框内联展示 `[图标] <主名称> · <邮箱地址>` 并附完整 `title`，下拉展开列表保持原有双行结构；
  2. 在 `desktop/frontend/src/styles/custom-controls.css` 增加 `.custom-select-trigger-label`（`max-width: 45%; flex-shrink: 0`）、`.custom-select-trigger-sep`、`.custom-select-trigger-sublabel`（`12px` 等宽字体 + `var(--text-muted)` 单行省略）及 `:disabled` 回复发件锁定态可读性样式，并将复选框基础规则归入 `controls.css` 确保单文件均 `<= 200` 行；
  3. 统一启用全站 5 处邮箱账户选择器（`ComposeHeaderFields.tsx`、`ComposeTab.tsx`、`AutoReplyTab.tsx`、`AdvancedSearchModal.tsx`、`RuleEditorModal.tsx`）的 `showSublabelInTrigger` 与 `resolveSidebarAccountTitle(acc, lang)` + `acc.email` 映射，并将写信发件人框放宽至 `maxWidth: 420`、`minMenuWidth={300}`。
- 验证结果：
  - 新增 `desktop/frontend/tests/custom-select.test.mjs`，执行 `task verify`、`npm run typecheck`、`npm test`（`124/124` 全绿通过）与 `npm run build` 均零告警通过。
