# TASK-20261126-017 · 重构图片大图预览器（ImageLightbox 智能透明底板、悬浮胶囊去重与三段式阻尼动效）

- 状态：Completed
- 实现提交：待提交（工作区已通过全量验证）
- 实际改动：
  1. **悬浮毛玻璃胶囊与操作去重**（`ImageLightboxTopbar.tsx`、`ImageLightboxControls.tsx`、`image-lightbox.css`、`image-lightbox-controls.css`）：去掉厚重通栏顶条与底边框，改为左右独立悬浮毛玻璃胶囊（左上展示文件图标、文件名、`来源 · W × H px` 副文案及多图分割线 + `1 / N` 徽标；右上展示带微缩色块的「棋盘格 / 浅灰底板 / 纯黑」三段切换器 + 独立 `Esc` 圆角关闭按钮），移除右上角重复的「另存为」按钮并将保存能力统一收敛到底部主按钮「保存原图」，同时通过 `--lb-*` 变量完整适配暗色深邃磨砂画布与亮色柔和浅雾磨砂画布；
  2. **零依赖离屏 Canvas 透明与明暗采样**（`imageSurfaceAnalysis.ts`、`useLightboxGalleryState.ts`、`ImageLightboxModal.tsx`、`image-lightbox-stage.css`）：`onLoad` 在离屏 `32×32` `<canvas>` 采样像素透明占比（`alpha < 245` 占比 `> 5%`）与感知亮度（`0.299R + 0.587G + 0.114B`），偏深色透明图（`< 135`，如黑色 Meta Logo）自动推荐 `light` 浅灰底板、偏浅色透明图（`>= 185`）自动推荐 `dark` 深色底板、中性透明图推荐 `checker` 棋盘格、普通非透明照片返回 `none` 原图高质感投影；捕获跨域 `SecurityError` 时按扩展名与尺寸平滑回退不抛错；透明图及小尺寸徽标（`< 420 × 220`）自动包裹 `.lightbox-media-mat` 呼吸感衬底卡并支持用户手动切换覆盖；
  3. **三段式阻尼进退场动效与图层隔离**（`OverlayRouter.tsx`、`useLightboxViewport.ts`、`image-lightbox-motion.css`）：`OverlayRouter` 的 `useValuePresence` 退场保留时长提升至 `180ms` 并向 Lightbox 传递 `closing` / `data-closing="true"`；外层 `.lightbox-stage-frame` 独立承载打开（`220ms cubic-bezier(0.22, 1, 0.36, 1)`）与关闭（`170ms cubic-bezier(0.4, 0, 1, 1)`）缩放淡入淡出，顶/底悬浮胶囊 `35ms` 错峰滑入、`120ms` 率先退场，内层 `.lightbox-media-carrier` 独立承载 `translate3d + scale + rotate`（拖拽时即时关闭 transition），切图施加 `160ms` 交叉淡入，并补齐 `prefers-reduced-motion` `120ms` 纯透明降级与中英双语词典。
- 验证结果：
  - 新增 `desktop/frontend/tests/image-lightbox.test.mjs`，全部变更手写文件均严格 `<= 200` 行；执行 `task verify`、`npm run typecheck`、`npm test`（`128/128` 全绿通过）与 `npm run build` 均零报错通过。
