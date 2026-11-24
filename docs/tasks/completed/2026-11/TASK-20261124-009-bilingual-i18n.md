# TASK-20261124-009 · 全站中英双语（zh-CN / en-US）强类型国际化与英文排版防溢出

- 状态：Completed
- 当前行为：`settings.language` 已支持持久化 `"zh-CN" | "en-US"`，但前端各业务模块硬编码中文文案，且读信工具栏固定槽位宽度在英文下易截断文字。
- 方案：
  1. 建立零重型外部依赖的强类型 `desktop/frontend/src/i18n/` 架构（按 14 个功能域拆分 `zh/*` 与 `en/*`，`enUS` 通过 `satisfies typeof zhCN` 逐键编译期校验），提供 `useI18n()`、命令式 `t()`、模板变量插值、ICU / `plural` 英文单复数辅助与统一日期/相对时间格式化器。
  2. 在 `index.html`、`themeStorage.ts` 与 `useWorkspaceStore.ts` 中同步持久化 `omnimail:lang` 并联动 `document.documentElement.lang`，在 `tokens.css` 为 `:root[lang="en-US"]` 配置优先 `Inter` 的英文排版字体栈。
  3. 校准英文防溢出布局：更新 `readerToolbarLayout.ts`、`useReaderToolbarLayout.ts`、`ReaderToolbar.tsx` 并新增 `styles/i18n-layout.css`，为英文提供独立槽位测量与紧凑间距，加固列表分段 Tab（`All / Unread / Starred / Files`）、AI 头部芯片、快速回复栏与设置导航的 `white-space: nowrap` / `min-width: 0` / `text-overflow: ellipsis`；严格遵守主界面隐藏第三方翻译品牌（`Built-in free engine`）、设置页展示（`Bilibili Free Translate (Recommended)`），100% 复用现有 `BrandLogo`、`ProviderIcon` 与 `Icon`。
  4. 全量覆盖 `common`、`shell`、`mail`（含 `reader`、`translation`、`security`）、`ai`、`compose`、`contacts`、`settings`（全部 12 页签）、`onboarding`、`overlays`、`state` 与 `services/errorParser.ts`；全部手写源码文件均严格控制在 `<= 200` 行。
- 验证结果：
  - 新增 `desktop/frontend/tests/i18n.test.mjs`，全量前端单测（44/44）、`tsc --noEmit`、`eslint`、`pnpm build` 及全仓 `task verify`（含 Wails 绑定生成、Prettier、`gofmt`、`go vet`、`go test ./...` 与桌面端二进制构建）均 100% 通过。
