# TASK-20261123-002：优化亮暗色主题切换动画时长与缓动曲线，消除闪烁感

## 状态
Completed

## 原始需求
用户反馈亮暗色主题切换动画过快，视觉上像全屏闪烁，需要调整动画时长与过渡节奏，使切换自然柔和。

## 根因分析
1. **时长过短且缓动前段爆发过猛**：`desktop/frontend/src/state/themeTransition.ts` 原先采用 `duration: 260` 搭配急促前冲曲线 `cubic-bezier(0.2, 0, 0, 1)`，在前 80~90ms（仅 4~5 帧）内圆形半径便扩张过全屏对角线的 75% 以上，大面积亮暗反差在极短时间内翻转，人眼感知为闪烁而非扩散波纹。
2. **快照看门狗与帧边界稳健性不足**：
   - 原快照保护定时器 `guard = 80ms` 在高分屏或复杂视图下可能早于 WebView2 旧帧快照完成触发 `skipTransition()`，导致硬切闪烁；
   - `root.animate(...)` 原先未声明 `fill: "both"`，`::view-transition-group(root)` 未显式关闭浏览器默认 `250ms` 动画，且快速连续点击时旧 `vt.finished` 可能提前移除 `data-vt-switching`。
3. **减弱动态模式与同步回退不同步**：当系统开启 `prefers-reduced-motion: reduce` 时原先直接跳过 View Transition 落入局部选择器 `180ms` 过渡，导致未覆盖节点瞬切、已覆盖节点慢切的两段式闪烁；此外 `flushSync` 前后重复执行本地落盘也占用了首帧主线程时间。

## 实际改动
1. `desktop/frontend/src/state/themeTransition.ts`（185 行）：
   - 将圆形扩散时长调整为按视口对角线自适应的 `520ms~620ms`（常规桌面约 `540ms`），缓动改为柔和对称曲线 `cubic-bezier(0.4, 0, 0.2, 1)`，并补齐 `fill: "both"` 锁定首尾帧；
   - 当系统启用 `prefers-reduced-motion: reduce` 且支持 View Transition 时，改为无位移的 `360ms` 整屏柔和交叉淡化（`opacity: [0, 1]`）；
   - 将快照保护阈值从 `80ms` 放宽至 `400ms`，引入递增序号隔离并发点击清理，并将点击坐标有效窗口扩至 `800ms`（过滤键盘 `(0, 0)` 合成事件）。
2. `desktop/frontend/src/styles/motion-theme.css`（164 行）：
   - 为 `::view-transition-group(root)` 显式声明 `animation: none;`，避免默认 `250ms` UA 动画干扰；
   - 将顶栏分段滑块过渡调整至 `260ms cubic-bezier(0.4, 0, 0.2, 1)`，无 View Transition 回退过渡放缓至 `380ms` 并补齐 `.left-sidebar`、`.btn` 等容器覆盖。
3. `desktop/frontend/src/state/useWorkspaceStore.ts`（179 行）：
   - 去除切换前的重复 `persistLocalTheme` 调用，并将设置持久化 IPC 推迟至状态提交后的下一宏任务，保证首帧快照零阻塞。

## 验证结果
- 已通过：`task verify`（Wails 绑定、`gofmt`、Prettier、ESLint、`tsc --noEmit`、Vite 构建、`go vet`、`go test ./...`）全部 0 错误通过；
- 已通过：`task build` 已重新生成开发程序 `desktop/bin/omnimail.exe`；
- 已通过：本次修改的 3 个文件均严格控制在 200 行以内。
- 未验证事项：后续在 [TASK-20261123-007](TASK-20261123-007-fix-theme-consecutive-switch-and-jank.md) 中进一步完成高频连续点击的 GPU 原地折返优化。
- 关联文档：[当前状态](../../../plans/CURRENT.md)、[产品范围](../../../product/PRD.md)。
- Git 提交：实现提交 `4697c40`。
