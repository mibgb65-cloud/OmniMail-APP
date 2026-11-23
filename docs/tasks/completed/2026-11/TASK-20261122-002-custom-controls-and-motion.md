# TASK-20261122-002：全站去原生化自定义控件与交互动效体系统一改造

## 状态

Completed

## 原始需求

基于 `OmniMail-redesign.fig` 最新更新的 `Responsive-Layouts`、`Custom Controls & Overlays` 与 `Motion & Transitions` 三页规范，完成前端统一打磨：

1. **顶栏垂直恒定与浮层抽屉对齐**：保持全断点顶栏 `h=52px`、圆角 `12px`、左右内边距 `14px`、窗口外边距 `10px`、下间距 `8px`（工作区顶部基准线恒定 `y=70px`），搜索框 `width: clamp(220px, 34vw, 460px)`，小屏浮层抽屉遮罩顶部对齐顶栏下方 `y=70px`。
2. **全站去原生化自定义控件（亮/暗双模式）**：
   - 全局替换所有原生 `<select>` 为自定义 Portal `CustomSelect` 组件（贴近窗口底部或弹窗底部按钮时自动向上 `flip`、支持 `↑/↓/Enter/Esc` 键盘导航与勾选态）；
   - 全局移除所有 HTML 原生 `title="..."` 属性，替换为自定义 Portal `Tooltip` 组件（`350ms` 延迟、支持未读数与快捷键胶囊、`960×640` 左侧 `Icon Rail` 统一在图标右侧 `8px` 垂直居中弹出）；
   - 统一自定义右键菜单与「…」更多操作菜单（分组分割线、快捷键右对齐、危险项红底高亮）；
   - 自定义表单原语与日期时间选择（替换原生 `checkbox / radio / date / time / color`，屏蔽密码框原生 `::-ms-reveal` 眼图标并统一自定义显隐切换）；
   - 自定义 `6px` 细滚动条与统一 Focus Ring，禁用 `window.confirm` / `alert`。
3. **落地 `Motion & Transitions` 动效体系**：
   - 写入 `--dur-instant/fast/base/emphasis` 与 `--ease-standard/enter/exit/spring` CSS 变量；
   - 实现 7 大核心切换动画：邮件列表切正文（`140ms` 可打断）、主路由切换（Persistent Shell 顶栏/侧栏框架不动，`180ms`）、居中弹窗（`200ms In / 140ms Out`）、右侧 AI 与左侧导航浮层抽屉（`240/220ms In / 180ms Out`）、发送撤销 Toast 弹出与倒计时条、筛选 Tab 滑动指示条与紧凑回复栏 `grid-template-rows` 展开；
   - 兼容 `@media (prefers-reduced-motion: reduce)` 降级为 `100ms` 纯透明度切换。

## 实际结果

- **去原生化通用控件库**：新增 [CustomSelect.tsx](../../../../desktop/frontend/src/components/common/CustomSelect.tsx)、[popoverPosition.ts](../../../../desktop/frontend/src/components/common/popoverPosition.ts)、[Tooltip.tsx](../../../../desktop/frontend/src/components/common/Tooltip.tsx)、[ActionMenu.tsx](../../../../desktop/frontend/src/components/common/ActionMenu.tsx)、[Checkbox.tsx](../../../../desktop/frontend/src/components/common/Checkbox.tsx)、[PasswordInput.tsx](../../../../desktop/frontend/src/components/common/PasswordInput.tsx)、[DateTimePicker.tsx](../../../../desktop/frontend/src/components/common/DateTimePicker.tsx) 及配套样式 [custom-controls.css](../../../../desktop/frontend/src/styles/custom-controls.css)、[datetime-picker.css](../../../../desktop/frontend/src/styles/datetime-picker.css)，替换全仓所有 `<select>`、`title=`、原生复选框/色板/日期时间输入与密码显隐控件，并拦截非输入区浏览器默认右键菜单。
- **双模式样式与细滚动条**：更新 [tokens.css](../../../../desktop/frontend/src/styles/tokens.css) 与 [base.css](../../../../desktop/frontend/src/styles/base.css)，声明 `color-scheme: light/dark`、`6px` 透明轨道细滚动条、统一 `:focus-visible` 高亮环与 `::-ms-reveal` 屏蔽规则。
- **7 大核心切换动画体系**：新增 [usePresence.ts](../../../../desktop/frontend/src/state/usePresence.ts)、[keyframes.css](../../../../desktop/frontend/src/styles/keyframes.css) 与 [motion.css](../../../../desktop/frontend/src/styles/motion.css)，在 [App.tsx](../../../../desktop/frontend/src/App.tsx)、[OverlayRouter.tsx](../../../../desktop/frontend/src/components/overlays/OverlayRouter.tsx)、[ComposeModal.tsx](../../../../desktop/frontend/src/components/compose/ComposeModal.tsx)、[MailListPane.tsx](../../../../desktop/frontend/src/components/mail/MailListPane.tsx)、[MailReaderPane.tsx](../../../../desktop/frontend/src/components/mail/reader/MailReaderPane.tsx)、[QuickReplyBox.tsx](../../../../desktop/frontend/src/components/mail/reader/QuickReplyBox.tsx) 与 [ToastStack.tsx](../../../../desktop/frontend/src/components/common/ToastStack.tsx) 完整落地可打断正文切换、Persistent Shell 主路由切换、弹窗与双侧浮层抽屉进退场、筛选胶囊滑动指示、紧凑回复框平滑展开、撤销发送倒计时条及 `prefers-reduced-motion` 降级。

## 验证与限制

- **源码约束与零残留检索**：全仓 148 个手写 `.go` / `.ts` / `.tsx` / `.css` 文件全部 `<= 200` 行；`desktop/frontend/src/` 下 `<select>`、`title=`、原生 `checkbox/radio/date/time/color`、`window.confirm` / `alert` 检索结果全部为 `0`。
- **全量构建检查**：`task format` 与 `task verify`（Wails 绑定、Prettier、ESLint、TypeScript、`vite build`、`go vet`、`go test`、`go build`）全部零错误通过。
- **多视口与双主题实测**：在 `1440×900`、`1280×720`、`960×640` 亮/暗双模式下实测确认：
  - `.topbar` 恒定 `top=10px, height=52px`，`.workspace-stage` 与浮层抽屉遮罩顶部恒定 `y=70px`，零横向溢出；
  - 暗色 `960×640` 下手动 IMAP 弹窗底部「加密方式」下拉自动向上翻转（`data-side="top"`），完全不遮挡右下角主提交按钮，支持 `ArrowDown + Enter` 联动端口更新与自定义密码明文显隐；
  - `960×640` 左侧 `Icon Rail` Tooltip 在图标右侧 `8px` 垂直居中弹出，展示未读计数与快捷键胶囊且不遮挡下方图标；
  - 筛选 Tab 滑动、正文切换、紧凑回复框展开、撤销发送倒计时 Toast 与抽屉/弹窗进退场动画均流畅运行。
- **关联文档**：[当前状态](../../../plans/CURRENT.md)、[产品范围](../../../product/PRD.md)。
- **Git 提交**：实现提交 `4697c40`。
