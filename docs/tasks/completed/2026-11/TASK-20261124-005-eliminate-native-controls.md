# TASK-20261124-005 · 清理残留原生下拉与勾选框并建立全局门禁

- 状态：Completed
- 当前行为：`TranslationEngineFields.tsx`、`TranslationSettingsTab.tsx`、`TranslationPopover.tsx` 与 `DuplicateGroupCard.tsx` 仍残留 5 处原生 `<select>` 与 2 处原生 `<input type="checkbox">`；`TranslationPopover` 内嵌 `CustomSelect` 时存在 Portal 点击误关与 `Esc` 捕获同时收起两层浮层的风险，且仓库缺少自动阻止原生下拉/单复选框回流的规则门禁。
- 方案：将 7 处原生控件统一替换为 `CustomSelect` 与 `Checkbox`，修复双层 Portal 点击与分层 `Esc` 收起逻辑，对齐亮/暗主题滚动视口与聚焦环样式，并在 ESLint、前端单测和编码规范中固化门禁。
- 验证计划：全仓搜索确认 `desktop/frontend/src` 零原生 `<select>`、`<option>`、`type="checkbox"`、`type="radio"`；执行前端单测、`tsc --noEmit`、`pnpm build` 与 `task verify`。

## 实现与验证

- 替换全部 7 处原生控件：`TranslationEngineFields.tsx`（翻译服务提供商，含 `sublabel` 与 `hint`）、`TranslationSettingsTab.tsx`（默认目标语言支持 `searchLabel="搜索语言…"` 匹配名称与代码、默认显示模式）、`TranslationPopover.tsx`（源语言与目标语言 `compact fullWidth` 下拉、同步翻译主题 `Checkbox`）与 `DuplicateGroupCard.tsx`（展开邮箱行 `Checkbox`，并为 `Checkbox` 补充 `disabled` 支持）。
- 处理嵌套 Portal 浮层交互：`CustomSelectPopover` 增加 `data-omnimail-popover="select"` 与 `maxHeight` 视口边界收敛，`computePopoverGeometry` 优化短窗口底部自动上翻与右侧防溢出，`usePopoverDismiss` 在 `Escape` 时执行 `preventDefault` + `stopImmediatePropagation`；`useTranslationAnchor.ts` 放行嵌套下拉 Portal 点击，初始聚焦改为 `button[role="combobox"], button, input`，并在检测到嵌套下拉展开时让首次 `Esc` 仅收起下拉菜单、二次 `Esc` 才关闭 `TranslationPopover`。
- 亮/暗主题与样式收口：清理 `controls.css`、`mail-translation.css`、`translation-settings.css` 中废弃的原生 `select` 选择器，拆分 `tooltip.css` 保持所有源码文件不超过 200 行，统一 `.custom-select-search` 吸顶遮罩与 `.fade-scroll-viewport` 焦点轮廓，消除原生灰底黑框。
- 全局门禁：`eslint.config.mjs` 增加 `no-restricted-syntax` 拦截 `<select>`、`<option>`、`<input type="checkbox">`、`<input type="radio">`（已通过 `eslint --stdin` 负向用例验证返回错误），新增 `tests/custom-controls-guard.test.mjs` 扫描源码并单测浮层边界。
- 验证结果：`desktop/frontend/src` 原生控件扫描匹配数为 `0`；`tsc --noEmit`、`pnpm build`（零错误零警告）及全量 `task verify`（含 `gofmt`、Prettier、ESLint、35 项前端单测、`go vet`、`go test ./...` 与开发构建）全部通过。
- 未验证事项：按协作规则未启动原生桌面窗口进行人工点击冒烟。
- 实现已提交：`10e54548e47b0574ccbed4ef1031e4c1ef2dc24f`，纳入 [Beta 9 本地安装包](TASK-20261124-010-windows-beta-9-local-release.md)。
- 关联：[编码规范](../../../development/CODING_RULES.md) · [测试与质量门](../../../development/TESTING.md)。
