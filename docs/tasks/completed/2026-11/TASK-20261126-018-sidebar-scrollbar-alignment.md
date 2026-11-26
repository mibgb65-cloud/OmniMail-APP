# TASK-20261126-018 · 修复左侧边栏及嵌套滚动区滚动条压盖卡片边框与操作项错位

- 状态：Completed
- 实现提交：待提交（工作区已通过全量验证）
- 实际改动：
  1. **左侧边栏与抽屉滚动条贴边对齐**（`desktop/frontend/src/styles/sidebar.css`、`desktop/frontend/src/styles/responsive-laptop.css`）：为 `.sidebar-scroll` 设置 `margin-inline: -12px; --scroll-padding: 0 12px;`（与 `.sidebar-pane` 的 `padding: 12px` 精确抵消），为 `.left-nav-drawer .sidebar-scroll` 及 `<= 1439px` 笔记本断点 `.sidebar-pane .sidebar-scroll` 设置 `margin-inline: -10px; --scroll-padding: 0 10px;`。顶部导航、分隔线、邮箱卡片与底部菜单的左右对齐线保持 100% 不变，而 `.fade-scroll-track` 落入最右侧边缘留白槽，彻底不再遮挡选中蓝框、状态绿点、未读数、悬停重命名按钮及「+ 添加」按钮；
  2. **同步对齐全仓嵌套 `FadeScroll` 容器**（`settings.css`、`label-popover.css`、`sync-status-popover-cards.css`、`topbar-update-popover.css`、`about-updater.css`、`compose-inline-ai-card.css`）：统一为 `.settings-nav-scroll`（`±12px`）、`.lpp-list`（`±7px`）、`.ssp-card-list`（`±16px`）、`.tup-notes-scroll`（`±16px`）、`.ufm-notes-scroll`（`±16px`）与 `.cia-preview-scroll`（`±14px`）补齐负外边距出血与等宽 `--scroll-padding`，消除滚动条压在导航徽标、标签行或文本末端的同类错位；
  3. **补充单元测试**：在 `desktop/frontend/tests/overlay-scrollbar.test.mjs` 新增侧边栏、抽屉、笔记本断点及设置导航栏出血对齐断言。
- 验证结果：
  - 全部修改与新增文件均严格 `<= 200` 行；执行 `task verify`、`npm run typecheck`、`npm test`（`129/129` 全绿通过）与 `npm run build` 均零报错通过。
