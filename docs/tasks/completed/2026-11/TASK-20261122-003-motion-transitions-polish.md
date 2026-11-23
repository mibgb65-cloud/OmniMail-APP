# TASK-20261122-003：完整落地 Motion & Transitions 动效规范与退出过渡体系

## 状态

Completed

## 原始需求

基于 `OmniMail-redesign.fig` 的 `Motion & Transitions` 页面（4 张规范卡、分镜与参数总表），完整落地前端页面切换与组件交互动效体系：

1. **全局 Motion Tokens 统一收口**：统一复用 `--dur-instant/fast/base/emphasis` 与 `--ease-standard/enter/exit/spring`，清除样式表中残留写死的 `0.14s ease` / `0.16s ease` 参数，严禁对 `width / height / top / left / margin` 做过渡。
2. **7 大核心动效场景完整对齐**：
   - **邮件列表切换正文**：列表卡片背景/描边 `100ms var(--ease-standard)`；Reader 正文直接替换挂载，`opacity: 0→1 + translateY(4px→0)` `140ms var(--ease-enter)`，切换时重置正文 `scrollTop = 0`，工具栏与底部回复栏静止，完整支持键盘 `J / K` 连续快速按压实时打断。
   - **主页面路由切换（统一收件箱 ↔ 联系人与通讯录 / 规则 / 诊断）**：Persistent Shell 保持顶栏与左侧导航外框静止，主视图槽位进场 `opacity: 0→1 + translateX(±10px→0)` `180ms var(--ease-standard)`（返回收件箱对称反转 `-10px→0`），旧视图退场 `opacity: 1→0` `80ms var(--ease-exit)`。
   - **居中弹窗进出场**：Scrim `160ms In / 120ms Out`，弹窗主体 `200ms var(--ease-enter)` In (`scale(0.96→1) + translateY(8px→0) + opacity`) / `140ms var(--ease-exit)` Out (`scale(1→0.97) + translateY(0→4px) + opacity`)。
   - **小屏双向浮层抽屉**：右侧 Omni AI 抽屉 `240ms var(--ease-spring)` In（内部 AI 卡片 `25ms` 轻量 stagger 淡入）/ `180ms var(--ease-exit)` Out；左侧导航抽屉 `220ms var(--ease-enter)` In / `180ms var(--ease-exit)` Out；顶栏位于遮罩之上，底层三栏静止。
   - **自定义浮层控件真实进退场与连续 Tooltip**：`CustomSelect`、`DateTimePicker`、`ActionMenu`（右键与「…」菜单）进场 `opacity: 0→1 + scale(0.97→1) + translateY(±4px→0)`（随上下方向适配）`140ms var(--ease-enter)`，退场延迟卸载真实播放 `100ms var(--ease-exit)`；`Tooltip` `350ms` 延迟后 `120ms var(--ease-enter)` 淡入 + `4px` 方向微移，并在相邻按钮（如 `Icon Rail`）连续悬停时跳过延迟即时切换。
   - **发送撤销 Toast、紧凑回复栏与滑块指示器**：Toast `220ms --ease-spring` In / `150ms --ease-exit` Out + `linear` 倒计时条（悬停暂停）；紧凑回复栏 `grid-template-rows: 0fr→1fr` `200ms` 展开 / `160ms` 收起；筛选 Tab 与顶栏主题分段开关统一使用 `transform: translateX` `150ms var(--ease-standard)` 滑块指示器。
   - **亮/暗主题切换**：支持 `document.startViewTransition` 时以主题切换按钮为圆心执行 `260ms` 圆形扩散（`clip-path: circle(...)`）过渡；不支持时回退至 `180ms var(--ease-standard)` 全局同步切色。
3. **无障碍降级与零滚动条闪现**：`@media (prefers-reduced-motion: reduce)` 移除所有 `translate / scale` 位移缩放，统一降级为 `100ms` 纯 `opacity` 淡入淡出；全流程外层容器严格 `overflow: hidden` 杜绝滚动条闪现。

## 实际落地结果

1. **Motion Tokens 与样式表全面标准化**：
   - 清理 `buttons.css`、`controls.css`、`mail-card.css`、`mail-list.css`、`pages.css`、`settings.css`、`sidebar.css`、`topbar.css` 中全部散落的 `0.14s ease` / `0.16s ease`，全站 `0.\d+s` 硬编码时长归零，`width / height / top / left / margin` 过渡归零。
   - 升级 `keyframes.css`、`motion.css` 并新增 `motion-theme.css`（挂载于 `main.tsx`）：覆盖上下方向感知的 Popover 进退场、四向 `Tooltip` `4px` 微移、主路由 `80ms` `.route-exit-layer` 退场层 + `180ms` 方向滑入、右侧 AI 抽屉 `25ms` 子卡片 stagger 淡入、Toast 进退场与悬停暂停倒计时条、顶栏主题滑块 `.theme-seg-indicator`、`::view-transition-*(root)` 图层规则与 `prefers-reduced-motion: reduce` 纯 `100ms opacity` 降级。
2. **核心组件与交互状态升级**：
   - 新增 `src/state/themeTransition.ts` 并接入 `useWorkspaceStore.ts`：记录最近指针坐标（键盘触发时回退至 `.theme-segmented` 几何中心），通过 `document.startViewTransition` 播放 `260ms` 圆形扩散切换，不支持或减弱动态偏好时自动回退至 `180ms` `data-theme-sync` 全局同步切色。
   - 升级 `useShortcuts.ts`、`AppContext.tsx`、`MailReaderPane.tsx`、`MailCard.tsx`：支持 `J / K` 连续快速切信实时打断、`C` 新建写信，切换邮件时通过 `useLayoutEffect` 立即将 `.reader-scroll` 的 `scrollTop` 重置为 `0`，并自动滚动列表选中卡片至可视范围。
   - 升级 `App.tsx`、`ContactsWorkspace.tsx`、`ContactDetailPanel.tsx`：顶栏与左侧导航栏外壳保持绝对静止，主视图槽位 `.route-slot-wrap` 同时支持旧路由 `80ms` 淡出与新路由 `180ms` 正反向（`fwd` / `back`）滑入，联系人详情抽屉通过 Portal 挂载至 `#workspace-stage`。
   - 升级 `CustomSelect.tsx`、`DateTimePicker.tsx`、`ActionMenu.tsx` 及 `ReaderMoreMenu.tsx` / `MailContextMenu.tsx` / `MailListPane.tsx` / `ContactsTableRows.tsx`：统一接入 `useValuePresence(..., 100)` 与 `data-closing="true"`、`data-side="top|bottom"`，实现真实 `100ms --ease-exit` 延迟卸载动画。
   - 升级 `Tooltip.tsx`：支持四向 `data-side` `4px` 方向淡入与 `280ms` 窗口内热启动（`Icon Rail` 连续滑动免 `350ms` 延迟即时切换）。

## 验证记录

- `task format` 与全仓行数/样式审计：全仓 150 个手写 `.go` / `.ts` / `.tsx` / `.css` 文件全部 `<= 200` 行（最高 `QuickReplyBox.tsx` 196 行），CSS 硬编码秒数与布局属性过渡均为 `0` 处。
- `task verify`：退出码 `0`（Wails 绑定生成、Prettier 检查、ESLint、`tsc --noEmit`、Vite 189 模块构建、`go vet`、`go test`、`go build` 全绿通过）。
- 内置浏览器多视口自动化实测（`1440×900` 亮色 & `960×640` 亮/暗双模式）：
  - `J / K` 连续快速按键切信零迟滞，`.topbar`（`y=10, h=52`）与 `.reader-toolbar` 零位移；
  - `统一收件箱 ↔ 通讯录与 VIP` 双向路由切换 `data-dir="fwd" | "back"` 生效，顶栏与左侧导航栏包围盒零变化；
  - `CustomSelect`（`100ms`）、`SettingsModal`（`140ms`）与 `960×640` AI 抽屉（`180ms`）关闭时均捕获到 `data-closing="true"` 延迟卸载动画并正常销毁；
  - `960×640` `Icon Rail` 右侧 Tooltip（`data-side="right"`）连续悬停相邻图标时跳过 `350ms` 延迟即时挂载；
  - 顶栏暗色切换滑块、紧凑回复栏 `grid-template-rows` 展开与底部撤销发送 Toast 倒计时条均验证通过。
- **关联文档**：[当前状态](../../../plans/CURRENT.md)、[产品范围](../../../product/PRD.md)。
- **Git 提交**：实现提交 `4697c40`。
