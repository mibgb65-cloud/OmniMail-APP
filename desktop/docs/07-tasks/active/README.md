# 进行中的任务（active）

> 状态：已生效 | 最后更新：2026-10-25

本目录存放**当前迭代进行中**的任务，一个任务一个文件：`TASK-<4位序号>-<slug>.md`。
模板与规则见 [任务管理](../README.md#4-任务记录模板)，项目入口见 [AGENTS.md](../../../../AGENTS.md)。

## 当前迭代

| 任务 | 标题 | 负责人 | 状态 | 优先级 |
| --- | --- | --- | --- | --- |
| [TASK-0001](../archive/2026/10/TASK-0001-docs-skeleton.md) | 文档目录骨架与初始内容（已归档） | @arch-lead | 已完成 | P0 |
| [TASK-0002](TASK-0002-project-skeleton.md) | 工程骨架：Wails 启动 + 绑定打通 | @backend-lead | 进行中 | P0 |
| [TASK-0003](TASK-0003-ci-pipeline.md) | CI 流水线（三平台 lint/test/build） | @devops | 待开始 | P0 |
| [TASK-0004](../archive/2026/10/TASK-0004-i18n-migration.md) | 接入 i18next 国际化框架（已归档） | @Codex | 已完成 | P1 |
| [TASK-0005](TASK-0005-agent-workflow.md) | 统一 AI 开发入口与任务工作流 | @Codex | 待评审 | P1 |
| [TASK-0006](TASK-0006-lucide-icons.md) | 接入 Lucide React 并统一功能图标 | @Codex | 待评审 | P1 |
| [TASK-0007](TASK-0007-language-dropdown.md) | 统一设置语言下拉菜单样式 | @Codex | 待评审 | P1 |
| [TASK-0008](TASK-0008-sidebar-brand-size.md) | 加大侧栏品牌文字 | @Codex | 待评审 | P2 |
| [TASK-0009](TASK-0009-mail-sidebar-ui.md) | 工作空间邮件导航 UI | @Codex | 待评审 | P1 |
| [TASK-0010](TASK-0010-mail-ai-layout.md) | 邮件与 AI 分析区布局 | @Codex | 待评审 | P1 |
| [TASK-0011](TASK-0011-startup-chrome.md) | 调整开屏操作栏 | @Codex | 待评审 | P2 |
| [TASK-0012](TASK-0012-move-development-status.md) | 将开发状态移至设置关于页 | @Codex | 待评审 | P1 |
| [TASK-0013](TASK-0013-fixed-workspace.md) | 固定首页工作区 | @Codex | 待评审 | P1 |
| [TASK-0014](TASK-0014-ai-panel-animation.md) | AI 面板收起展开动效 | @Codex | 待评审 | P2 |
| [TASK-0015](TASK-0015-selected-folder-heading.md) | 展示当前邮件分类 | @Codex | 待评审 | P1 |
| [TASK-0016](TASK-0016-workspace-vertical-spacing.md) | 收紧右侧工作区上下留白 | @Codex | 待评审 | P2 |
| [TASK-0017](TASK-0017-sidebar-button-density.md) | 收紧侧栏分类按钮留白 | @Codex | 待评审 | P2 |
| [TASK-0018](TASK-0018-morphicons-and-folder-animation.md) | 统一 Morphicons 与分类气泡动效 | @Codex | 待评审 | P1 |
| [TASK-0019](TASK-0019-circular-theme-transition.md) | 点击位置圆形扩散主题切换 | @Codex | 待评审 | P1 |
| [TASK-0020](TASK-0020-sidebar-active-indicator.md) | 侧栏共享选中滑块 | @Codex | 待评审 | P1 |
| [TASK-0021](TASK-0021-sidebar-outline-fill-icons.md) | 侧栏图标描边与实心变形 | @Codex | 待评审 | P1 |
| [TASK-0022](TASK-0022-theme-transition-reentry.md) | 修复连续主题切换动画提前结束 | @Codex | 待评审 | P1 |
| [TASK-0023](TASK-0023-mail-status-bubbles.md) | 顶部邮件状态气泡 | @Codex | 待评审 | P2 |
| [TASK-0024](TASK-0024-mail-workspace-toolbar.md) | 邮件区域通栏工具条与双列布局 | @Codex | 待评审 | P1 |
| [TASK-0025](TASK-0025-search-field-redesign.md) | 搜索邮件输入框重构与视觉优化 | @Codex | 待评审 | P1 |
| [TASK-0026](TASK-0026-sidebar-label-spacing.md) | 收紧侧栏“工作空间”分组标题留白 | @Codex | 待评审 | P2 |
| [TASK-0027](TASK-0027-sidebar-mailbox-section.md) | 侧栏新增“我的邮箱”分组区域 | @Codex | 待评审 | P2 |
| [TASK-0028](TASK-0028-settings-storage-section.md) | 设置页新增“存储情况”分类 | @Codex | 待评审 | P2 |
| [TASK-0029](TASK-0029-scrollbar-fade-in.md) | 滚动条默认占位隐藏、悬停淡入 | @Codex | 待评审 | P1 |
| [TASK-0031](TASK-0031-messages-panel-offset.md) | 修消息面板与铃铛按钮脱开 | @Codex | 待评审 | P2 |

## 说明

- 满足任务管理规范的结案条件后，文件移动到 [archive/](../archive/) 下实际归档年月目录；未授权提交且未确认免提交结案时留在 active 待评审。
- 每个任务文件的状态行必须与上表一致；不一致以文件为准并立即修正表格。
