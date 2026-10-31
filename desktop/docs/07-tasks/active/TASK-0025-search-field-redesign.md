# TASK-0025 搜索邮件输入框重构与视觉优化

> 状态：待评审 | 负责人：@Codex | 创建：2026-10-27 | 优先级：P1

## 需求与范围

- 重构并美化“搜索邮件”输入框，去除浏览器原生聚焦黑框，改为 Linear / Notion / Apple Mail 风格的现代极简桌面端表面层级。
- 默认态：柔和浅灰填充 + 极淡边框，无深色实线边框；高度 36px，圆角 10px。
- 交互态：`:focus-within` 统一控制 hover / focus，200ms ease-out 过渡；聚焦时背景变为纯白（暗色更深），边框转为品牌高亮并带柔和扩散光晕；左侧放大镜同色过渡。
- 功能：空且未聚焦时右侧显示 `Ctrl K` / `⌘K` 快捷键徽章并支持 `Ctrl+K`/`Cmd+K` 聚焦；有内容时切换为圆形清除按钮，点击清空并保持聚焦。
- 仅前端 UI，不改后端、桥接接口与生成绑定，不新增依赖。

## 分析与计划

- 现状：`MailToolbar` 内联 `<label class="search">` + 原生 `input[type=search]`，仅有 `border-color` 变化，聚焦轮廓来自 `globals.css` 的全局 `:focus-visible`，呈现原生黑框。
- 计划步骤一：新增 `components/SearchField/`（受控组件 + CSS Module + 快捷键标签工具 + 测试），在 `styles/tokens.css` 补齐亮暗两套 field 令牌，并补中英文 `clearSearch` 文案。
- 计划步骤二：`MailToolbar` 改用 `SearchField` 并持有本地查询状态，`UiIcon` 支持可选 `strokeWidth`（默认 1.6 不变），同步更新工具条测试。
- 设计取向：项目无 Tailwind，按用户给出的 Tailwind 意图翻译为 CSS Module + 设计令牌；聚焦强调色由用户指定改为蓝色（亮色 `#3b82f6`、暗色 `#60a5fa`），由 `--field-accent` 单一令牌控制，可随时切回品牌珊瑚或中性灰。
- 追加需求（本轮）：输入框聚焦与清除按钮统一为蓝色色语言，不再残留中性灰悬停；暗色聚焦底色带极轻蓝调，避免"只剩边框变色"的割裂感。
- 按步骤修改，不运行完整 `verify`/打包，仅用热更新窗口截图与局部测试核对。

## 验收标准

- [x] 默认无深色实线边框与原生 outline，浅灰填充 + 极淡边框，高度 36px、圆角 10px。
- [x] hover 背景加深、边框显现；聚焦为近白/深色微蓝底 + 蓝色边框 + 光晕，过渡 200ms。
- [x] 放大镜 16px、`stroke-width` 1.75、与文字间距约 10px，聚焦转蓝。
- [x] 清除按钮悬停为蓝色图标 + 蓝色透明底，与聚焦态同一色语言。
- [x] 空且未聚焦显示快捷键徽章，`Ctrl+K`/`Cmd+K` 可聚焦；有内容显示圆形清除按钮，清空后保持聚焦。
- [x] 亮/暗主题、中英文下外观正常，无障碍名称与 `aria-describedby` 保留。

## 实现与验证

- 新增 `components/SearchField/`：受控 `SearchField`（`label/value/onValueChange/clearLabel` + 可选 `placeholder/describedBy/maxLength/className`）、`SearchField.module.css`、`searchShortcut.ts`（按平台返回 `Ctrl K` / `⌘K`）与组件测试。
- `styles/tokens.css` 新增亮暗两套 `--field-*` 令牌：填充、hover、focus、边框、光晕、占位符、图标、`kbd` 与强调色；尺寸取 36px 高、10px 圆角、13px 字号、10px 图标间距。强调色为蓝色：亮色 `--field-accent: #3b82f6`、暗色 `#60a5fa`，边框、光晕、图标、清除按钮全部由该令牌派生。
- 交互：`:focus-within` 统一表达焦点（亮色 `#fafcff` 近白微蓝 / 暗色 `#15191f` 深底微蓝 + 蓝色边框 + 3px 光晕 + 轻阴影），200ms `--ease-out` 过渡；输入框 `:focus-visible` 关闭原生轮廓，`type=search` 隐藏 WebKit 原生放大镜与清除按钮；放大镜 16px / `stroke-width` 1.75 并随焦点转蓝。
- 清除按钮悬停由中性灰改为强调色：底色 `--field-accent-soft`（亮色 12%、暗色 16% 蓝色透明），图标转 `--field-accent`，与聚焦态共用同一色语言；原 `--field-clear-hover-bg` 令牌已移除，避免死令牌。
- 功能：空且未聚焦显示 `kbd` 徽章，`Ctrl+K` / `⌘K` 聚焦并选中；有内容显示 20px 圆形清除按钮，`onMouseDown` 阻止默认避免失焦，点击清空后保持焦点。`clearSearch` 中英文文案已补。
- `MailToolbar` 改用 `SearchField` 并持有本地查询状态，仅移除旧 `.search` 内联样式；`UiIcon` 增加可选 `strokeWidth`（默认 1.6，既有行为与测试不变）。
- 局部验证：`vitest run src/components/SearchField`（6 项）、`npm run typecheck`、`eslint src/components/SearchField src/app/MailToolbar.tsx`、`prettier --check` 相关文件全部通过；早前一轮 `src/app/MailToolbar.test.tsx` + `src/components/UiIcon` 亦随全套 50 项通过。
- 窗口实测（Vite 热更新，未重新打包、未跑完整 `verify`）：亮色默认（浅灰填充 + 极淡边框 + `Ctrl K` 徽章）、亮色聚焦（`#fafcff` 近白底 + 蓝色边框/光晕 + 蓝放大镜 + 徽章让位）、有内容（圆形清除按钮）、清除按钮悬停（蓝色 × + 蓝色透明圆底）、暗色默认与暗色聚焦（`#15191f` 微蓝深底 + 蓝色边框）均按预期；像素抽样确认暗色聚焦填充 `(21,25,31)`、亮色聚焦填充 `(250,252,255)`。
- 本轮截图（`desktop/.devdata/previews/`）：`c26-light-default`、`c26-light-click-focus`、`c26-light-typed3`、`c26-light-clear-hover2`、`c26-dark-default`、`c26-dark-focus`、`c26-light-focus-final`；热更新流程另用临时值 `#e6f0ff` 验证过改动可见后已还原。
- 环境副作用（如实记录）：本轮为跑 `prettier` 使用 `pnpm exec`，pnpm 判定 `node_modules` 由其他包管理器安装，将其重装为 pnpm 布局并把原 19 个直接依赖移入 `node_modules/.ignored`；**安装版本与 `package-lock.json` 完全一致**（vite 8.3.5、react 18.3.1、i18next 26.5.10、eslint 10.13.0、vitest 5.0.5、typescript 5.9.3 等），误生成的 `pnpm-lock.yaml` 已删除，`typecheck`/`vitest`/`eslint` 在新布局下均通过。如需恢复纯 npm 布局，应在关闭 dev server 后执行 `npm ci`。
- 未验证：真实检索（仍是本地输入预览）、macOS 快捷键徽章实际渲染、其他平台 WebView 表现、暗色下清除按钮悬停的实拍（仅按同一令牌推导）。

## Git 与风险

- 未授权提交或推送；不暂存、不归档，待用户评审。
- 风险：`Ctrl+K` 为组件级全局监听，后续若出现其他输入型全局面板需避免快捷键冲突；清除按钮的 `onMouseDown` 阻止默认在触屏点击场景仍可用（依赖 click）。
