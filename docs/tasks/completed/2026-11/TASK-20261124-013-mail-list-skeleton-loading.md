# TASK-20261124-013 · 邮件列表切换骨架屏、顶部流光刷新条与丝滑入场动效

- 状态：Completed
- 当前行为：切换邮箱/文件夹/筛选标签时固定延迟 `60ms` 发起列表请求且未区分首次加载与空态，导致列表区与阅读区中途闪烁「没有邮件 / 未选择邮件」空状态，且异常失败时 `loaded` 可能卡死。
- 方案：将首次加载（`isInitialLoading`）、后台刷新（`isRefreshing`）与异常状态（`listError`）从真实空态彻底拆分；切换账号/文件夹零延迟发起查询（仅搜索关键词输入保留 `120ms` 防抖）；新增列表 6 卡骨架屏 + 阅读区正文骨架屏 + 顶部 `2px` 流光刷新条 + 刷新图标旋转 + 卡片错峰丝滑入场动效。

## 实现与验证

- **根因修复与状态拆分**：
  - 新增 `desktop/frontend/src/state/mailListLoadingPolicy.ts`，提供 `getListReloadDelayMs`（切账号/文件夹/筛选 Tab 为 `0ms`，仅搜索输入防抖 `120ms`）、`resolveMailListViewPhase`、`resolveReaderViewPhase` 与 `formatListScopeKey`。
  - 升级 `useMailPages.ts`、`useMailLoadMore.ts` 与 `useMailStore.ts`：按 `buildQuery` 作用域实时区分 `isInitialLoading`、`isRefreshing` 与 `listError`，请求失败时标记 `loaded: true` 并记录错误（绝不卡死在骨架屏），支持点击重试恢复加载；快速连续切换作用域通过递增 `listSeq` 自动丢弃过时回写。
- **骨架屏、刷新流光与丝滑入场**：
  - 新增 `MailListSkeleton.tsx`（6 张严格对齐 `MailCard` 几何的骨架卡，自动适配常规与 `compact` 模式、第 4~6 张透明度递减 `0.92 / 0.78 / 0.62`、含顶部 `list-group-head` 占位条）与 `reader/ReaderSkeleton.tsx`（阅读区工具栏、标题与 4 行正文占位）。
  - 新增 `styles/mail-list-skeleton.css` 与 `styles/reader-skeleton.css`（亮色 `#eef2f7 → #f8fafc → #eef2f7`、暗色 `#1c2433 → #263146 → #1c2433`、`1.35s ease-in-out infinite` 扫光、`prefers-reduced-motion: reduce` 静态降级）。
  - 升级 `MailListPane.tsx`：`.list-header` 底部内嵌 `2px` 流光进度条 `.list-refresh-bar`，同步/加载/刷新中联动刷新按钮 `.is-spinning` 旋转，且 `isInitialLoading` 时副标题显示「正在加载邮件… / Loading emails…」。
  - 升级 `MailListBody.tsx`、`MailListExtras.tsx` 与 `MailReaderPane.tsx`：严格按「无账号 → 骨架屏 → 错误重试 → 真实空态 → 正常列表（`140ms ease-out` 淡入 + `4px` 上浮，前 6 张卡 `15ms` 错峰）」优先级渲染，阅读区在 `isInitialLoading && !selectedMail` 时渲染 `<ReaderSkeleton />`。
  - 补齐 `i18n/{zh,en}/mailListBackfill.ts` 双语词条。
- **源码行数核验**：所有新增与修改源码文件均严格控制在 `<= 200` 行内。
- **验证结果**：新增单元测试 `desktop/frontend/tests/mail-list-loading-state.test.mjs`；全量 `task verify`（`bindings`、`gofmt`、`prettier --check`、`eslint`、`tsc --noEmit`、`vite build`、56 项前端单测、`go vet`、`go test ./...`、`go build`）与生产构建 `pnpm --dir desktop/frontend build` 均全部通过。
- **未验证事项**：按协作规则未启动原生桌面窗口人工预览，未做发布包，未创建 Git 提交。
