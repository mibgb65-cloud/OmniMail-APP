# TASK-20261126-011 · 标签管理轻量化交互重构（贴标签轻浮层、右键级联子菜单与侧边栏原地管理）

- 状态：Completed
- 实现提交：`6a443d28eaa0177badc74dcc3ba5ecc6e80f96e2`
- 范围：
  1. 对齐 OpenPencil `15 · 会话与批量整理` 新增的「标签管理轻量化交互规范」（亮色 `261906429:3406` / 暗色 `261906429:3596`），新增 `LabelPickerPopover.tsx`（高频贴标签轻浮层，支持锚定或坐标定位、自动聚焦搜索、上下键 + `Enter` / `Space` 导航、多选三态勾选即时生效、无匹配一键创建并自动贴标，严禁放全局删除按钮）与 `LabelEditPopover.tsx`（左侧栏原地新建/改名/换色/删除浮层）；
  2. 打通三大入口：左侧边栏标签区（`+` 原地新建、悬停编辑按钮与右键菜单原地改名/换色/删除、显示标签邮件计数）、邮件右键菜单（「贴标签 `L >`」悬停/点击/`ArrowRight` 级联展开子面板连续勾选）、阅读器工具栏「标签」按钮/批量多选栏「标签」按钮/快捷键 `L` 锚定浮层，以及 `ReaderSubjectSection.tsx` 已贴标签微胶囊 `×` 直删与末尾 `+` 锚定贴标；
  3. 同步升级兜底 `LabelManageModal.tsx` 支持行内改名与改色；补齐亮暗色样式、双语词典（`zh-CN` / `en-US`）与前端单元测试 `label-popover.test.mjs`。

## 关键实现

- **轻浮层组件与三态状态闭环**：
  - `desktop/frontend/src/components/common/Checkbox.tsx` 扩展 `indeterminate?: boolean`（`aria-checked="mixed"` + `minus` 图标，保持全仓零原生 `<input type="checkbox">`）；
  - `desktop/frontend/src/state/useMailLabels.ts` 升级 `toggleMailLabel`（支持多选半选时先补齐全部拥有、全拥有时批量移除）并新增 `createAndApplyLabel(name, color, mailIds)`（乐观插入 `tempId` 并等待 `mailApi.saveLabel` 返回真实 ID 后对齐替换与调用 `mailApi.applyLabels` 落库）；
  - 新增 `labelPopoverLogic.ts`、`labelPickerPosition.ts`、`useLabelPopoverDismiss.ts`、`LabelPickerPopover.tsx`、`LabelPickerCreateFooter.tsx` 与 `LabelEditPopover.tsx`。
- **三大日常入口与兜底模态框**：
  - 侧边栏拆分为 `SidebarLabelSection.tsx` + `SidebarAccountsAndLabels.tsx`，支持邮件计数（`0` 隐藏）、悬停 `···` 编辑按钮及右键直接弹出右侧 `LabelEditPopover`；
  - `ActionMenu.tsx` 支持 `renderSubmenu` 悬停/点击/`ArrowRight` 级联展开与跨 Portal 外部点击判据，`MailContextMenu.tsx` 升级为「贴标签 `L >`」；
  - `ReaderToolbar.tsx`、`useReaderToolbarActions.ts`、`ReaderMoreMenu.tsx`、`ReaderSubjectSection.tsx`、`MailListExtras.tsx`、`useShortcuts.ts` 与 `AppContext.tsx` 贯通工具栏、更多菜单、批量栏、快捷键 `L` 与阅读器主题胶囊 `×` 直删 / `+` 贴标；
  - `LabelManageModal.tsx` + `LabelManageRow.tsx` 支持行内改名、改色与三态勾选。

## 实际验证

- 单文件行数门禁：所有新增与修改的前端 `.ts` / `.tsx` / `.css` / `.mjs` 手写文件均严格 `<= 200` 行；
- `pnpm --dir desktop/frontend test`：114 项前端单元测试全部通过（含新增 `tests/label-popover.test.mjs` 的三态计算、搜索过滤与无匹配创建判据、视口翻转定位、双语词典对称性及 `LabelPickerPopover` 无全局删除按钮源码门禁）；
- `task verify`：Wails 绑定、`gofmt`、Prettier、ESLint、`tsc` 类型检查、Vite 生产构建、前端单测、`go vet`、`go test ./...` 与开发构建全部零错误通过。
