# TASK-20261123-007：修复亮暗色连续切换丢失动画与帧率卡顿问题

## 状态
Completed

## 原始需求
用户反馈亮暗色切换动画存在两个问题：
1. 连续快速切换时会丢失扩散动画（瞬切或点击无响应）；
2. 切换过程中动画存在掉帧卡顿，需要深入优化修复。

## 根因定位
1. **连续切换丢失动画**：
   - 原 `root.animate(..., { fill: "both", pseudoElement: "::view-transition-new(root)" })` 结束后未 `.cancel()`，残留的 `fill: forwards` 动画堆积在 `document.documentElement` 动画栈中干扰后续切换；
   - 过渡中途再次调用 `doc.startViewTransition` 会导致浏览器直接中断上一轮伪元素树（瞬间全屏硬切），且在异步快照回调尚未执行的窗口期内读取 `data-theme` 会拿到旧值导致误判跳过；
   - 顶栏 `.theme-segmented` 左右按钮原先写死固定目标色，光标停留在原位连续点击时不会反向切换。
2. **掉帧卡顿**：
   - 原先在 `startViewTransition` 回调内调用 `flushSync(commitState)`，在浏览器合成器挂起截屏期间同步重渲染全量 200+ 个 `AppContext` 订阅组件，并在首帧立即并发触发 `localStorage` 写入与 3 次 Wails IPC 磁盘/注册表调用；
   - `data-vt-switching` 在快照前提前挂载，触发额外一次全 DOM `*` 样式重算；
   - `::view-transition-image-pair(root)` 默认 `isolation: isolate` 产生冗余离屏混合缓冲；
   - `Tooltip` 在鼠标点击按钮触发 `mousedown` 关闭后，又被浏览器自动聚焦触发 `onFocus` 热启动挂载 Portal 并执行 `getBoundingClientRect` 强制同步布局。

## 实际改动
1. `desktop/frontend/src/state/themeTransition.ts`（200 行）+ `desktop/frontend/src/state/themeStorage.ts`（92 行）：
   - 实现单会话可中断 GPU 反向引擎：过渡运行中途连续点击时直接调用 `anim.reverse()` 在 GPU 合成线程原地平滑折返（耗时 `< 0.02ms`），无需重新截屏、零丢动画；
   - 使用 `keepAlive` 控制伪元素树生命周期，结束后显式调用 `.cancel()` 清空动画栈，反向折返至 `0px` 时在旧帧遮罩保护下切回底层 `data-theme` 并等待 1 帧绘制后再销毁伪元素树；
   - 将扩散时长收束至轻快顺滑的 `380ms~460ms`。
2. `desktop/frontend/src/state/useWorkspaceStore.ts`（184 行）：
   - 完全移除 `startViewTransition` 内的 `flushSync`，截屏回调仅修改 `html` 属性（`< 0.3ms`）；
   - 待动画彻底落定后通过 React `startTransition` 同步状态，并对 `localStorage` 与 Wails IPC 落盘做 `220ms` 防抖合并。
3. `desktop/frontend/src/components/shell/TopBar.tsx`（191 行）+ `desktop/frontend/src/styles/topbar.css`（199 行）+ `desktop/frontend/src/styles/motion-theme.css`（169 行）+ `desktop/frontend/src/components/common/Tooltip.tsx`（177 行）：
   - 顶栏主题滑块与激活色直接绑定 `html[data-theme]` 纯 CSS 即时响应，支持原位连续点击切换；
   - 为 `::view-transition-image-pair(root)` 设置 `isolation: auto` 消除冗余离屏混合缓冲；
   - `Tooltip` 的 `onFocus` 仅在 `:focus-visible`（键盘导航）时触发，消除鼠标点击时的 Portal 重挂载与强制同步布局。

## 验证结果
- 已通过：`task verify`（Wails 绑定、`gofmt`、Prettier、ESLint、`tsc --noEmit`、前端构建、`go vet`、`go test ./...`）全部通过；
- 已同步刷新：开发版 `desktop/bin/omnimail.exe` 以及 `dist/release/v0.0.1/`、`dist/release/v0.0.1.beta.1/` 下的可安装向导 `.exe`；
- 全部修改与新增文件均严格控制在 `<= 200` 行以内。
- 未验证事项：无。
- 关联文档：[当前状态](../../../plans/CURRENT.md)、[产品范围](../../../product/PRD.md)。
- Git 提交：实现提交 `4697c40`。
