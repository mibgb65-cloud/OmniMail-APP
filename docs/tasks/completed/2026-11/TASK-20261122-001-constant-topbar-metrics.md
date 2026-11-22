# TASK-20261122-001：统一顶栏恒定高度与连续平滑缩放规范

## 状态

Completed

## 原始需求

1. 全窗口尺寸统一锁定顶栏高度 `52px`（不再按断点切换 `54/50/48px`），圆角统一 `12px`，水平内边距 `14px`。
2. 窗口外边距统一 `10px`，顶栏与下方主工作区的垂直间距统一 `8px`，确保拖拽缩放窗口时顶栏及下方三栏顶部基准线零位移（恒定 `70px`）。
3. 顶栏内部所有控件高度与尺寸全断点保持恒定：品牌图标 `28×28`、品牌字号 `15px`、同步胶囊 `h=26px`、搜索框 `h=34px`、右侧工具按钮 `h=32px`、窗口控制按钮 `28×28`。
4. 搜索框宽度改为连续响应式 `width: clamp(220px, 34vw, 460px)`，仅保留窄屏下同步文案简写与语言按钮隐藏。
5. 同步检查收件箱、通讯录等所有共享顶栏的页面，确保全站一致，并验证三视口尺寸下零横向溢出。

## 实际结果

- **全局壳层与恒定基准线**：更新 [layout.css](../../../../desktop/frontend/src/styles/layout.css)，统一 `.app-shell` 为 `padding: 10px; gap: 8px;`，移除 [responsive-laptop.css](../../../../desktop/frontend/src/styles/responsive-laptop.css) 与 [responsive.css](../../../../desktop/frontend/src/styles/responsive.css) 中的外边距与顶栏高度覆盖，使顶栏底边与下方工作区顶部基准线在全断点恒定为 `70px`。同步对齐 [CommandPaletteModal.tsx](../../../../desktop/frontend/src/components/overlays/CommandPaletteModal.tsx) 顶部偏移 `70px`。
- **顶栏恒定控件与连续平滑搜索框**：更新 [TopBar.tsx](../../../../desktop/frontend/src/components/shell/TopBar.tsx)、[BrandLogo.tsx](../../../../desktop/frontend/src/components/common/BrandLogo.tsx) 与 [topbar.css](../../../../desktop/frontend/src/styles/topbar.css)，锁定顶栏 `h=52px`、圆角 `12px`、内边距 `0 14px`、品牌图标 `28×28`、字号 `15px`、同步胶囊 `h=26px`、搜索框 `h=34px` + `width: clamp(220px, 34vw, 460px)`、右侧工具按钮 `h=32px`、窗口控制按钮 `28×28`，仅保留窄屏同步文案简写与 `<= 1024px` 语言切换隐藏。

## 验证与限制

- **源码行数核查**：全仓 134 个手写 `.go` / `.ts` / `.tsx` / `.css` 文件全部 `<= 200` 行（`> 200` 行文件数为 `0`）。
- **构建与测试**：`task format` 与 `task verify` 全部零错误通过，开发版 `desktop/bin/omnimail.exe` 已更新。
- **多视口跨页面实测**：在收件箱与通讯录页面对 `1440×900`、`1280×720`、`1025×720`、`1024×720`、`960×640` 实测校验：
  - `.topbar` 在全视口恒定 `top=10px, height=52px, border-radius=12px, padding=0 14px`；
  - `.workspace-stage` 与各分栏顶部基准线全视口恒定 `top=70px`（零位移跳动）；
  - `.topbar-search-wrap` 高度恒定 `34px`，宽度随 `clamp(220px, 34vw, 460px)` 平滑过渡（`460px` → `435.2px` → `348.5px` → `348.2px` → `326.4px`），`1025↔1024` 临界无突变，全视口零横向溢出。
- **Git 提交**：本记录与实现纳入同一个提交。可用 `git log --diff-filter=A --format=%h -- docs/tasks/completed/2026-11/TASK-20261122-001-constant-topbar-metrics.md` 查询实现提交号。
