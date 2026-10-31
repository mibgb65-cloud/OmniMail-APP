# TASK-0027 侧栏新增“我的邮箱”分组区域

> 状态：待评审 | 负责人：@Codex | 创建：2026-10-27 | 优先级：P2

## 需求与范围

- 用户要求在左侧栏邮件分类列表下方“增加一个区域，显示我的邮箱”。
- 只做前端 UI：新增分组标题、空态提示和“添加邮箱”入口，样式复用现有 token 与侧栏排版节奏；不改后端、不接账号、不变更邮件分类列表与选中滑块，不新增依赖。

## 分析与计划

- 现状：侧栏顺序为品牌 → 撰写按钮 → “工作空间”标题 → 6 个邮件分类 → 底部设置/消息；无任何邮箱账号区域。
- 计划：在 `</nav>` 与 `.sidebar-footer` 之间插入 `<section aria-labelledby>`，含标题“我的邮箱”、“尚未添加邮箱”空态行和一条禁用态“添加邮箱”入口（带“待开发”说明）。
- 空态行与入口行按文件夹行同样的左内距 12px、图标 18px、图标与文字 12px 间距对齐，保证与上方列表同一网格；分组上方用 20px 间距 + 12px 内距 + `--color-border-subtle` 分隔线与“工作空间”分组拉开层级。
- 入口按项目规范保持禁用：`disabled` + `aria-describedby` 指向“待开发” + `title` 说明尚未接入，避免暗示已具备账号接入能力。
- 用运行中的 Wails dev 窗口 + Vite 热更新核对，不重新打包、不跑完整 `verify`。

## 验收标准

- [x] 侧栏邮件分类下方出现“我的邮箱”分组，含空态提示与“添加邮箱”入口。
- [x] 入口可见但禁用，无障碍名称为“添加邮箱”、描述为“待开发”，鼠标悬停给出“尚未接入”说明。
- [x] 中英文均有完整文案，`en` 与 `zh-CN` 键结构一致。
- [x] 原有分类列表、选中滑块定位、底部设置/消息入口行为不变。

## 实现与验证

- `desktop/frontend/src/app/WorkspaceSidebar.tsx`：新增 `mailboxLabelId` / `mailboxStatusId`（`useId`），在导航与页脚之间插入 `section.mailbox-section`（`aria-labelledby` 指向标题），内含 `p.sidebar-label` 标题、`p.mailbox-empty` 空态（`mailOpen` 图标）与禁用按钮 `button.mailbox-add`（`aria-label` + `aria-describedby` + `title`，`Plus` 图标 + “待开发”）。
- `desktop/frontend/src/app/App.module.css`：新增 `.mailbox-section`（`margin-top: var(--space-5)`、`padding-top: var(--space-4)`、`border-top: 1px solid var(--color-border-subtle)`）、`.mailbox-empty`、`.mailbox-add`、`.mailbox-add:disabled`、`.mailbox-add small`。`:disabled` 覆盖全局 `button:disabled` 的 `--color-bg-sunken` 填充，保持与文件夹列表一致的幽灵行，并把 `cursor: wait` 改回 `not-allowed`。
- `desktop/frontend/src/components/UiIcon/UiIcon.tsx`：`icons` 增加 `addMailbox: Plus`（静态引用，沿用现有图标映射约定）。
- `desktop/frontend/src/locales/zh-CN/navigation.json`、`desktop/frontend/src/locales/en/navigation.json`：新增 `mailboxesLabel`、`mailboxesEmpty`、`addMailbox`、`addMailboxUnavailable`。
- `desktop/frontend/src/app/WorkspaceSidebar.test.tsx`：新增中英文两例断言——`region` 名称为“我的邮箱/My mailboxes”、位于 `<nav>` 之后、不在导航内、空态文案可见、入口按钮可见且禁用、可访问描述为“待开发/Planned”、`title` 为未接入说明、图标 `aria-hidden`。
- 验证：`npm run test -- src/app/WorkspaceSidebar` 12 项通过；`npm run test` 全量 24 文件 250 项通过；`npm run typecheck` 无输出（通过）；`npm exec -- eslint` 上述三个 TSX 文件无输出；`npm exec -- prettier --check` 六个改动文件全部符合。
- 视觉验证：dev 窗口截图 `desktop/.devdata/previews/mb-final.png`（浅色整窗）与 `mb-final-zoom.png`（浅色 3x 局部）、`mb-dev-dark.png`（深色）。浅/深色下分隔线、标题、空态行、禁用入口均正常，图标与上方文件夹图标同一列。
- 未验证：真实邮箱账号数据接入后的列表形态（当前为纯前端空态）；窄屏断点下该分组未逐一实测；未重新打包，未做其他平台实测。

## Git 与风险

- 未授权提交或推送；不暂存、不归档，待用户评审。
- 风险：区域目前只展示空态，属界面预览，接入账号数据需后续任务替换 `mailbox-empty` 为空态/列表分支；文案“待开发”沿用项目既有 pending 约定，接入后应同步移除。

## 过程记录

- dev 服务器曾在一次热更新后返回旧的 `UiIcon.tsx`（无 `addMailbox`），导致“添加邮箱”行只占位不显示加号图标；核对 `http://localhost:9245/src/components/UiIcon/UiIcon.tsx` 返回内容确认模块未失效后用 touch 触发重编译，图标恢复。同类现象也出现在语言包：`createI18nInstance` 对 `resources` 做 `structuredClone`，JSON 热更新不会重建实例，需整页重载才显示新键（仅影响开发期预览，不影响构建产物）。
