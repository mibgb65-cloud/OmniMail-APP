# TASK-20261123-001：修复弹窗挂载时主工作区底部高度增加与视角弹跳问题

## 状态
Completed

## 原始需求
用户反馈在打开任意弹出框（如「本地多工作空间管理」等弹窗）时，工作台三栏卡片下方的留白高度会突然增加，关闭弹窗后又回弹，导致视角出现明显上下弹跳，需要定位根因并优化 UI。

## 根因分析
1. `.app-shell`（`desktop/frontend/src/styles/layout.css`）采用 `display: flex; flex-direction: column; padding: 10px; gap: 8px;` 纵向弹性布局。
2. `App.tsx` 原本将 `<ComposeModal />`、`<ComposeDock />`、`<OverlayRouter />`、`<ToastStack />` 直接作为 `.app-shell` 的子元素渲染。
3. `<OverlayRouter />` 与 `<ComposeModal />` 外层动画容器 `<div className="overlay-motion-root">` 未声明 `position: fixed` 脱离文档流（仅内层 `.modal-backdrop` 为 `fixed`），因此作为 `0px` 高的块级 Flex 子项参与了 `.app-shell` 排版。
4. 按 CSS Flexbox 规范，流内子项即使高度为 `0px`，仍会在 `#workspace-stage` 与其自身之间产生 `gap: 8px`（写信窗叠加二级弹窗时更会产生 `16px`），把底层三栏高度向上压缩并在弹窗关闭后回弹。

## 实际改动
1. `desktop/frontend/src/styles/motion.css`：为 `.overlay-motion-root` 显式声明 `position: fixed; inset: 0; z-index: 60;`，并为 `data-layer="overlay"` 设定 `z-index: 70`（确保写信窗上打开二级确认/定时弹窗时层级稳定）。
2. `desktop/frontend/src/App.tsx` & `desktop/frontend/src/components/overlays/OverlayRouter.tsx`：将 `<ComposeModal />`、`<ComposeDock />`、`<OverlayRouter />`、`<ToastStack />` 提至 `.app-shell` 外部（`.app-boot-stage` 浮层槽位），使 `.app-shell` 严格仅包含 `TopBar`、`StatusBanner` 与 `#workspace-stage` 三个流内布局节点。
3. `desktop/frontend/src/components/overlays/ProfileSwitchList.tsx`：对本地空间目录长路径补充 `minWidth: 0` 与单行省略（`truncate` + `title` 悬浮完整路径），避免弹窗内文字折行撑高卡片。

## 验证结果
- 已通过：`task verify`（绑定生成、`gofmt`、Prettier、ESLint、`tsc --noEmit`、前端构建、`go vet`、`go test ./...`）全部 0 错误通过；
- 已通过：`task build` 已重新编译开发程序 `desktop/bin/omnimail.exe`；
- 已通过：全仓库手写源码文件行数核验（`OVER_200_COUNT = 0`）。
- 未验证事项：按协作规则未自动启动原生桌面窗口。
- 关联文档：[当前状态](../../../plans/CURRENT.md)。
- Git 提交：实现提交 `4697c40`。
