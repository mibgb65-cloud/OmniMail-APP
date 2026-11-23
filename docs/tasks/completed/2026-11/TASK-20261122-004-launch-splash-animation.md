# TASK-20261122-004：桌面端冷启动开屏动画（Launch Splash Animation）

## 状态

Completed

## 原始需求

读取 `OmniMail-redesign.fig` 中 `Motion & Transitions` 页面的第 5 张画板 `05 · Launch Splash Animation`，实现桌面端冷启动开屏动画：

1. **视觉与双主题首帧零白屏**：
   - 还原亮色（`#F8FAFC`）与暗色（`#0B0E14`）开屏界面：居中 `104×104` 圆角 `26px` 徽章容器 + `64px` 四色棱镜折翼 SVG Logo + `OmniMail` 标题 + 副标题 + `240px` 细进度条 + 动态加载状态文案。
   - 首帧即读取上次持久化主题（或系统 `prefers-color-scheme`）设置背景色，确保冷启动零白屏闪烁；同步对齐桌面窗口配置初始背景色。
2. **四阶段动画编排（仅用 `transform` / `opacity`）**：
   - `0~280ms`：SVG 四个棱镜折翼各自偏移 `8px` 以 `45ms` stagger 聚合成完整图标，徽章 `scale(0.84→1)` 弹入；
   - `220~480ms`：徽章边缘掠过一次轻柔微光（Sheen），标题与副标题 `translateY(8px→0) + opacity` `240ms --ease-enter` 浮现；
   - `480ms~Ready`：与真实应用初始化/数据加载并行，设置 `minHold: 850ms` 防止极快启动闪屏；若加载超过 2 秒则平滑切换阶段状态文案并转为呼吸进度态；
   - `Exit (260ms)`：开屏层 `scale(1→1.03) + opacity(1→0)` 退幕，下方主工作台同步 `scale(0.985→1)` 稳重落位后彻底卸载开屏 DOM。
3. **触发条件与降级**：
   - 仅在应用冷启动前台拉起时展示一次（热重载 / 托盘唤醒 / 后台静默开机自启时直接跳过）；
   - 兼容 `prefers-reduced-motion: reduce`（静态展示 + `120ms` 纯淡出）。

## 实际落地结果

1. **Wails 窗口背景与静默自启对齐**：
   - 新增 `desktop/window_boot.go` 并在 `desktop/main.go`、`desktop/desktop_service.go` 接入：冷启动时读取 `ui-theme.json`（可信边界校验 `"light" | "dark"`）将原生窗口 `BackgroundColour` 设为亮 `#F8FAFC` / 暗 `#0B0E14`，识别 `--autostart / --silent / --minimized` 隐藏后台窗口并传入 `/?autostart=1`；新增 `SaveThemePreference` 桌面桥接同步持久化主题偏好，并补充 `desktop/desktop_service_test.go` 单元测试。
2. **前端首帧零白屏与主题持久化**：
   - 在 `desktop/frontend/index.html` `<head>` 注入同步内联脚本与首帧背景样式，在首帧渲染前读取 `localStorage("omnimail:theme")` 或系统 `prefers-color-scheme` 写入 `html[data-theme]`；
   - 在 `useWorkspaceStore.ts` 与 `themeTransition.ts` 中同步初始化并立即落盘主题偏好至 `localStorage` 与桌面桥接。
3. **四阶段棱镜聚合开屏组件与动效体系**：
   - 新增 `src/state/useLaunchSplash.ts`：实现一次性冷启动门控（跳过 Vite HMR 热重载、托盘唤醒、静默自启及隐藏窗口）、真实桌面桥接/字体并行初始化、`minHold: 850ms` 防闪屏、`>2000ms` 慢加载呼吸态与阶段状态文案平滑切换（`正在恢复本地邮件缓存…` 等）、以及退场后彻底卸载 DOM；
   - 新增 `src/components/shell/LaunchSplash.tsx`、`src/styles/splash.css`、`src/styles/splash-motion.css` 并在 `App.tsx` / `main.tsx` 接入：严格仅用 `transform` / `opacity` 编排四翼 `8px` 偏移 `45ms` stagger 聚合、徽章 `scale(0.84→1)` 弹入、微光扫过、标题副标题上浮、`240×4` `scaleX` 进度条、`260ms` 退幕 + 工作台 `scale(0.985→1)` 稳重落位，以及 `prefers-reduced-motion: reduce` 静态展示 + `120ms` 纯淡出降级。

## 验证记录

- `task format` 与全仓行数/样式审计：全仓 156 个手写源码文件全部 `<= 200` 行，CSS 硬编码秒数与布局属性过渡均为 `0` 处。
- `task verify`：退出码 `0`（Wails 绑定生成、Prettier 检查、ESLint、`tsc --noEmit`、Vite 195 模块构建、`go vet`、`go test`、`go build` 全绿通过）。
- 内置浏览器亮/暗双模式实测：
  - 亮色（`#F8FAFC`）与暗色（`#0B0E14`）冷启动首帧 `data-theme` 即刻匹配持久化/系统偏好，零白屏闪烁；
  - `104×104` 徽章、`64px` 四翼 SVG、`240×4` 进度条尺寸与画板一致；
  - 加载超过 `2000ms` 时进度条切换 `data-slow="true"` 呼吸态，文案平滑切换为 `"正在恢复本地邮件缓存…"`；
  - 退幕完成后 `.launch-splash` 节点数归零、`data-splash-state` 清空，点击邮件列表与控件零遮挡阻塞；
  - `?autostart=1` 与 `?tray=1` 场景直接跳过开屏。
- **关联文档**：[当前状态](../../../plans/CURRENT.md)、[产品范围](../../../product/PRD.md)。
- **Git 提交**：实现提交 `3cbd1bd`、`4697c40`。
