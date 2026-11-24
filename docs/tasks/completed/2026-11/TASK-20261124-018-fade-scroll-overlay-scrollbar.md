# TASK-20261124-018: 全局 FadeScroll 自定义悬浮滚动条（Overlay Scrollbar）

## 状态
已完成并验证通过（2026-11-24）。

## 完成内容
1. **保持原生零占位策略**：维持 `desktop/frontend/src/styles/scrollbar-reset.css` 隐藏原生滚动条，避免出现白边、挤压邮件卡片宽度或水平抖动。
2. **自定义悬浮滚动条几何计算与同步（`scrollFade.ts`）**：
   - 新增纯函数 `computeOverlayScrollbar`（最小滑块高度钳制为 `28px`，未溢出时隐藏）、`computeScrollTopForThumbDelta` 与 `computeScrollTopForTrackClick`。
   - 升级 `attachScrollFade`，在 `requestAnimationFrame` 与 `ResizeObserver` / `scroll` 中零重排同步更新滑块 `height` 与 `translate3d(0, y, 0)`，并通知活跃显隐状态。
3. **智能显隐与拖拽/点击轨道交互（`overlayScrollbar.ts` + `FadeScroll.tsx`）**：
   - 静置隐藏（`opacity: 0`）；滚动中、鼠标悬停在右侧 `10px` 宽热区或拖动滑块期间平滑淡入（`120ms ease-out`）；停止滚动且鼠标移出热区后延迟 `900ms` 平滑淡出（`280ms ease-out`）。
   - 支持滑块 `setPointerCapture` 拖动（拖动时临时禁用全局文本选中）按比例实时映射至 `viewport.scrollTop`，并支持点击轨道空白处快速跳转；原生 `scroll` 事件正常派发，不干扰邮件列表触底无限加载与「回到顶部」胶囊。
4. **亮/暗主题高对比配色（`fade-scroll.css`）**：
   - 轨道定位 `position: absolute; top: 4px; right: 2px; bottom: 4px; width: 10px; z-index: 6`（高于列表卡片与底部渐变遮罩，低于「回到顶部」胶囊与弹窗）；胶囊滑块默认宽 `5px`、悬停/拖拽拓宽至 `7px`，`border-radius: 999px`。
   - 亮色 `rgba(100, 116, 139, 0.36)` / `rgba(71, 85, 105, 0.62)`；暗色 `rgba(148, 163, 184, 0.34)` / `rgba(203, 213, 225, 0.60)`；遵守 `prefers-reduced-motion: reduce` 与打印隐藏规则。
5. **单元测试与验证**：
   - 新增 `desktop/frontend/tests/overlay-scrollbar.test.mjs`，覆盖未溢出隐藏边界、比例计算、超长列表 `28px` 最小高度钳制、拖动位移与轨道点击反算及 DOM 生命周期清理。
   - 所有新增与修改文件均控制在 200 行以内；`task verify` 全量通过（`tsc --noEmit`、`eslint` 0 error / 0 warning、`prettier --check`、`vite build`、`pnpm test` 77/77 通过、`go vet`、`go test ./...`、`go build`）。
