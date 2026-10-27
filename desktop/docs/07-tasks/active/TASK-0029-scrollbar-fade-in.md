# TASK-0029 滚动条默认占位隐藏、悬停淡入

> 状态：待评审 | 负责人：@Codex | 创建：2026-10-27 | 优先级：P1

## 需求与范围

- 用户要求“所有页面的滚动条，默认占位不显示，只在鼠标移动到对应区域的位置时，动画淡入显示，移开后动画淡出”。
- 只做前端 UI：滚动区域保留滚动条占位（不产生布局跳动），滑块默认透明，指针进入滚动区淡入、离开淡出，拖动时保持可见；不改后端、不新增依赖、不改各面板内容与业务逻辑。

## 分析与计划

- 现状：设置对话框的内容区与左侧导航依赖原生滚动条，Windows 下默认始终可见，与“扁平、克制”的视觉语言不一致。
- 方案：新增通用 `ScrollArea` 组件，用“原生滚动条隐藏 + 覆盖层滑块”实现：原生滚动行为不变（滚轮、键盘、触控板、`scrollIntoView` 全部保留），视觉滑块由 JS 按 `clientHeight / scrollHeight / scrollTop` 计算长度与位移，仅用 `transform: translateY()` 更新，避免触发布局。
- 淡入淡出用覆盖层 `opacity` 过渡而非 `visibility`，既能在中途被打断，也能在 jsdom 中被断言；`data-overflow` 控制“无溢出时彻底不参与指针事件”，`data-dragging` 保证拖动时指针移出仍可见。
- 占位用 `padding-inline-end: var(--scrollbar-reserve)`（12px）固定预留，滚动区左右内边距相应减去 12px，保持内容与标题、卡片边界对齐不变。
- 全局兜底：在 `globals.css` 给尚未接入 `ScrollArea` 的容器加 `scrollbar-width: thin` 与滑块配色，避免遗留原生粗滚动条。
- 用运行中的 Wails dev 窗口 + Vite 热更新核对浅色 / 深色效果，不重新打包、不跑完整 `verify`。

## 验收标准

- [x] 滚动条轨道默认不显示，滚动区保留固定占位，滑块出现 / 消失都不引起内容位移。
- [x] 指针进入滚动区淡入显示滑块，移出后淡出隐藏；拖动滑块时保持可见。
- [x] 内容未溢出时不渲染可见滑块，也不拦截该区域的指针事件。
- [x] 滑块长度与位置随内容、容器尺寸变化即时更新（`ResizeObserver`）。
- [x] 设置对话框内容面板与左侧导航均生效；浅色 / 深色下滑块对比度可读。
- [x] 尊重 `prefers-reduced-motion`，动画关闭时直接切换可见性。

## 实现与验证

- `desktop/frontend/src/components/ScrollArea/ScrollArea.tsx`（新增）：`ScrollArea` 接受 `className`（外框）、`viewportClassName`（滚动视口）与其余 `div` 属性（透传到视口，含 `hidden`、`onScroll` 转发）；内部状态 `thumb{height,offset}`、`scrollable`、`dragging`；`measure()` 在 `trackHeight <= 0` 时短路，`range <= 1` 判定为不溢出，滑块长度 `max(28, min(trackHeight, clientHeight / scrollHeight * trackHeight))`、位移按滚动比例映射到剩余轨道；0.5px 阈值内不重复 `setState`；`useEffect` 依赖 `[measure, hidden]` 挂载 `ResizeObserver` 监听视口与各直接子节点，卸载时断开。
- 拖动：`pointerdown` 记录起始指针 Y / `scrollTop` / 滑块几何并 `setPointerCapture`（jsdom 无 `setPointerCapture` 时按可选调用处理），`pointermove` 按 `dy / maxOffset * range` 反算 `scrollTop`，`pointerup` / `pointercancel` 结束并释放捕获。
- `desktop/frontend/src/components/ScrollArea/ScrollArea.module.css`（新增）：`.root` 相对定位 + `padding-inline-end: var(--scrollbar-reserve)`；`.viewport` `overflow-y: auto` + `scrollbar-width: none` + `::-webkit-scrollbar { width: 0 }`；`.track` 覆盖在预留槽内、`opacity: 0` + `pointer-events: none` + `var(--scrollbar-fade)` 过渡；`.root:hover` / `:focus-within` / `[data-dragging='true']` 提升为 `opacity: 1`；`[data-overflow='false']` 下轨道 `visibility: hidden`、滑块不接收指针事件；`.thumb` 悬停 / 拖动时宽度 +2px 并切到 `--scrollbar-thumb-hover`；`prefers-reduced-motion` 关闭过渡。
- `desktop/frontend/src/styles/tokens.css`：新增 `--scrollbar-reserve: 12px`、`--scrollbar-thickness: 4px`、`--scrollbar-thumb`、`--scrollbar-thumb-hover`、`--scrollbar-fade: 160ms`，深色块覆盖滑块两档透明度。
- `desktop/frontend/src/styles/globals.css`：`* { scrollbar-width: thin; scrollbar-color: var(--scrollbar-thumb) transparent; }` 作为未接入组件的兜底。
- `desktop/frontend/src/components/SettingsDialog/SettingsDialog.tsx`、`SettingsNavigation.tsx`、`SettingsDialog.module.css`：三个面板与左侧导航改用 `ScrollArea`（面板保留 `role="tabpanel"` / `aria-labelledby` / `hidden` / `tabIndex`）；`.navigation` 去掉自身滚动改为 flex 容器，新增 `.navigation-scroll` / `.navigation-viewport` 承接内边距；新增 `.body-frame`，`.body` 右内边距由 `--space-7` 收到 `--space-4` 以抵消 12px 占位。
- `desktop/frontend/src/components/ScrollArea/ScrollArea.test.tsx`（新增）：`applyMetrics` 注入 `clientHeight` / `scrollHeight` / `scrollTop`，覆盖“未溢出不显示滑块”“溢出时滑块长度与位置（0 / 112.5 / 225px）”“内容缩短后回到不溢出”“拖动改变 `scrollTop` 并切 `data-dragging`”“视口 `role` / `tabindex` / `hidden` 透传”。
- 验证：`npm run -s test` 全量 25 文件 257 项通过；`npm run -s typecheck` 退出码 0（首轮 `ScrollArea.test.tsx` 的 `applyMetrics` 参数把 `scrollHeight` 声明为必填导致 TS2345，改为可选并回落到 `clientHeight`）；`npm exec -- eslint src/components/ScrollArea src/components/SettingsDialog` 无输出；`npm exec -- prettier --check` 改动文件全部通过。
- 视觉验证：`desktop/.devdata/previews/sb-hover2.png`（浅色，指针在面板内，滑块可见）、`sb-idle.png`（同面板，指针移出后滑块淡出且布局无位移）、`sb-about-hover.png`（“关于”面板）、`sb-dark-hover.png`（深色，内容未溢出故无滑块）、`sb-dark-storage-hover.png`（深色“存储情况”，滑块可见、对比度正常）。
- 未验证：未在真实 Windows 高对比度 / 强制滚动条可见的系统设置下核对；触摸板惯性滚动与 `scrollTo` 动画期间滑块跟随未逐一实测；未重新打包，未做其他平台实测。

## Git 与风险

- 未授权提交或推送；不暂存、不归档，待用户评审。
- 风险：覆盖层滑块与原生滚动条并存，若某个容器自成层叠上下文或设置了 `container-type`，需要确认轨道 `z-index` 不被遮挡；若将来引入虚拟列表，需让 `ScrollArea` 的测量随行高变化触发（`ResizeObserver` 已覆盖直接子节点尺寸变化，间接变化依赖 `scroll` 事件）。

## 过程记录

- 初版用 `visibility` 做显隐，淡出无法中途打断且在 jsdom 中难以断言，改为常驻 DOM + `opacity` 过渡。
- 预留 12px 占位后设置面板卡片右边界比标题内缩，把滚动视口右内边距减 12px 后恢复对齐。
- jsdom 27.4 中 `PointerEvent` 存在但 `setPointerCapture` 未定义，指针捕获全部改为可选调用。
- 抓图核对深色态时把 `pointer.ps1` 的 `-Dx/-Dy` 当成窗口内相对坐标的偏移量，坐标整体错位点到遮罩层上导致对话框关闭；该脚本的 `-Dx/-Dy` 即截图内的绝对像素位置。
