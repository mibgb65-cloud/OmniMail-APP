# TASK-20261123-009：适配暗色主题专属品牌标志（logo-dark.svg）与平滑过渡

## 状态
Completed

## 原始需求
为应用顶栏与通用品牌标志 `BrandLogo` 补充暗色主题专属 SVG 资源 `logo-dark.svg`，随 `data-theme="dark"` 平滑切换，同时保持样式文件严格不超过 200 行。

## 实际改动
1. 新增 `desktop/frontend/src/assets/brand/logo-dark.svg` 并更新 `desktop/frontend/src/components/common/BrandLogo.tsx` 双图层叠放结构；
2. 将 `.brand-logo-img` / `.brand-logo-light` / `.brand-logo-dark` 主题显隐规则收纳至 `desktop/frontend/src/styles/motion-theme.css`（保持 `topbar.css` 199 行、`motion-theme.css` 191 行，均 `<= 200` 行）。

## 验证与限制
- 已通过：Prettier、ESLint、`tsc --noEmit` 与 Vite 构建全部通过，全仓库 `> 200` 行文件数为 `0`。
- 未验证事项：无。
- 关联文档：[当前状态](../../../plans/CURRENT.md)。
- Git 提交：本记录与实现纳入同一个提交。可用 `git log --diff-filter=A --format=%h -- docs/tasks/completed/2026-11/TASK-20261123-009-dark-brand-logo.md` 查询实现提交号。
