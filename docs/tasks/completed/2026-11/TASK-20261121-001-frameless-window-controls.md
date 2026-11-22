# TASK-20261121-001：移除原生窗口边框并接管自定义窗口控制

## 状态

Completed

## 原始需求

1. 窗口最大化、窗口最小化、关闭窗口均已在前端 UI 中实现，不再使用操作系统原生的窗口操控栏。

## 范围与方案

- 在 `desktop/main.go` 启用 Wails v3 无边框窗口（`Frameless: true`），隐藏系统原生标题栏与最小化/最大化/关闭按钮，同时保留系统圆角、阴影与窗口边缘缩放。
- 抽离自定义窗口控制组件 `desktop/frontend/src/components/shell/WindowControls.tsx`，将 UI 内的最小化、最大化/还原、关闭按钮直连 `@wailsio/runtime` 的 `Window.Minimise()`、`Window.ToggleMaximise()`、`Window.Close()`，不再将关闭按钮拦截到托盘预览弹窗。
- 在顶栏与首次引导顶栏配置 `--wails-draggable: drag` 拖拽区与空白区域双击最大化能力，并为所有可交互子元素设置 `--wails-draggable: no-drag`。

## 实际结果

- **无边框窗口配置**：更新 [desktop/main.go](../../../../desktop/main.go)，在 `WebviewWindowOptions` 中开启 `Frameless: true`。
- **自定义窗口控制闭环**：新增 [WindowControls.tsx](../../../../desktop/frontend/src/components/shell/WindowControls.tsx) 并在 [TopBar.tsx](../../../../desktop/frontend/src/components/shell/TopBar.tsx) 接入，同步最大化状态提示与顶栏空白处双击最大化；同步为 [OnboardingScreen.tsx](../../../../desktop/frontend/src/components/onboarding/OnboardingScreen.tsx) 顶栏补充拖拽与双击最大化能力。
- **拖拽边界与防挤压样式**：更新 [topbar.css](../../../../desktop/frontend/src/styles/topbar.css)，声明拖拽区与交互子元素 `no-drag` 规则，并固定右侧控制区防挤压。
- **关联文档更新**：同步更新 [当前状态](../../../plans/CURRENT.md)。

## 验证与限制

- **文件行数核查**：全仓 127 个手写 `.go` / `.ts` / `.tsx` / `.css` 文件全部 `<= 200` 行（`> 200` 行文件数为 `0`）。
- **完整校验通过**：执行 `task format` 与 `task verify` 全部通过（exit code 0），已重新生成开发版 `desktop/bin/omnimail.exe`。
- **未验证事项**：遵循协作规则，未自动启动原生桌面窗口做可视化实测，未制作发布包，未创建 Git 提交。
- **Git 提交**：本记录与实现纳入同一个提交。可用 `git log --diff-filter=A --format=%h -- docs/tasks/completed/2026-11/TASK-20261121-001-frameless-window-controls.md` 查询实现提交号。
