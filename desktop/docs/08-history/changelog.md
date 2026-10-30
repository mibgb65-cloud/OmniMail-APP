# 变更日志

> 状态：已生效 | 最后更新：2026-10-30

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](../00-guidelines/git-conventions.md#4-版本号semver)。

分类：`新增` / `变更` / `修复` / `移除` / `安全` / `已知问题`。

---

## [未发布]

### 新增
- 增加应用授权码账号添加、系统凭据适配、TLS IMAP/SMTP 认证、邮件正文与流式附件缓存、后台轮询、手动同步及纯文本发送；本轮基础闭环已提交归档，见 [TASK-0032](../07-tasks/archive/2026/10/TASK-0032-mail-account-integration.md)；未实现/未验证项保留在 [TASK-0037](../07-tasks/active/TASK-0037-mail-advanced-followups.md)，不含 OAuth、IDLE、草稿自动保存或发送附件。
- 新增 SQLite 账号存储基础：版本校验迁移、多服务商预设、独立 IMAP/SMTP 配置及内部账号仓储，应用启动/关闭接入数据库；尚未实现账号接入 UI、系统凭据保存或真实收发信，见 [TASK-0030](../07-tasks/archive/2026/10/TASK-0030-account-storage-foundation.md)。
- 邮件区域增加通栏搜索与邮件操作工具条，下方采用列表和内容双列布局；当前仅 UI 预览，见 [TASK-0024](../07-tasks/active/TASK-0024-mail-workspace-toolbar.md)。
- 分类标题后增加同步时间与未读邮件状态气泡，当前显示未接入数据的占位状态，见 [TASK-0023](../07-tasks/active/TASK-0023-mail-status-bubbles.md)。
- 建立 `desktop/docs` 九大分区文档骨架（45 份文档），覆盖规范、产品、架构、设计、开发、测试、发布、任务与历史。
- 补充根目录启动入口，完成现有桌面骨架的依赖安装与本地质量检查；实际验收范围见 [TASK-0002](../07-tasks/active/TASK-0002-project-skeleton.md)。
- 桌面工作台支持简体中文和英语，提供即时切换、系统语言识别及本地偏好保存；语言包按公共、导航、工作台和连接面板拆分，附一致性校验与接入约定。

### 变更
- 语言切换改为悬停/聚焦横向展开胶囊，选中高亮支持滑动回弹，保留中英偏好、主题适配和减少动态效果，见 [TASK-0038](../07-tasks/archive/2026/10/TASK-0038-language-hover-capsule.md)。
- 添加邮箱先选择预设服务商或自定义 IMAP/SMTP 卡片，再进入对应配置；支持返回重选并清除旧密码，Gmail OAuth 未配置限制明确展示，见 [TASK-0039](../07-tasks/archive/2026/10/TASK-0039-account-provider-selection.md)。
- 邮件列表移除上一页/下一页，改为滚动分批追加，支持错误重试、已加载范围刷新及阅读位置保持；筛选与未读统计仅覆盖已加载邮件，见 [TASK-0040](../07-tasks/archive/2026/10/TASK-0040-mail-infinite-scroll.md)。
- 左侧六个邮件分类图标增加 outline/fill 双向变形，选中为实心、未选中为描边，见 [TASK-0021](../07-tasks/active/TASK-0021-sidebar-outline-fill-icons.md)。
- 左侧导航选中背景改为共享圆角滑块，平滑移动至新的分类，见 [TASK-0020](../07-tasks/active/TASK-0020-sidebar-active-indicator.md)。
- 右上角亮暗主题切换增加基于点击位置的原生圆形扩散过渡，兼容普通切换降级，见 [TASK-0019](../07-tasks/active/TASK-0019-circular-theme-transition.md)。
- 调整分类气泡的上下对齐与切换节奏，完整显示“……”后再展开新标题，见 [TASK-0015](../07-tasks/active/TASK-0015-selected-folder-heading.md)。
- 功能图标统一改由 Morphicons 渲染，侧栏、菜单、设置和其他状态按钮的图标支持状态变形；邮件分类气泡增加文字淡出、收缩和展开动画，见 [TASK-0018](../07-tasks/active/TASK-0018-morphicons-and-folder-animation.md)。
- 收紧左侧邮件分类按钮的内部留白并保留按钮间距，见 [TASK-0017](../07-tasks/active/TASK-0017-sidebar-button-density.md)。
- 收紧首页右侧邮件及 AI 工作区的上下留白，见 [TASK-0016](../07-tasks/active/TASK-0016-workspace-vertical-spacing.md)。
- 侧栏邮件分类支持前端选择，工作区顶部以气泡标题显示所选分类；尚未接入邮件数据，见 [TASK-0015](../07-tasks/active/TASK-0015-selected-folder-heading.md)。
- 右侧 AI 分析面板收起和展开时增加宽度过渡动画，支持减少动态效果，见 [TASK-0014](../07-tasks/active/TASK-0014-ai-panel-animation.md)。
- 首页邮件与 AI 工作区适配窗口高度，取消首页横向和纵向滚动，见 [TASK-0013](../07-tasks/active/TASK-0013-fixed-workspace.md)。
- 将首页开发状态移至设置的关于页面，保留连接检查、版本信息及开屏重播，见 [TASK-0012](../07-tasks/active/TASK-0012-move-development-status.md)。
- 开屏顶部只保留窗口控制，背景与开屏统一，并移除跳过动画按钮，见 [TASK-0011](../07-tasks/active/TASK-0011-startup-chrome.md)。
- 工作区新增邮件列表、邮件查看与可折叠 AI 分析的界面占位，保留折叠的开发状态，见 [TASK-0010](../07-tasks/active/TASK-0010-mail-ai-layout.md)。
- 工作空间侧栏调整为六个邮件分类入口，仅展示 UI，尚未接入邮件功能，见 [TASK-0009](../07-tasks/active/TASK-0009-mail-sidebar-ui.md)。
- 工作台左上角侧栏的 OmniMail 品牌文字由 18px 调整为 20px，图标尺寸不变，见 [TASK-0008](../07-tasks/active/TASK-0008-sidebar-brand-size.md)。
- 侧栏、写邮件入口、窗口控制、语言菜单、设置及消息卡片的功能图标统一为 Lucide React，保持原有操作及无障碍名称；软件品牌和任务栏图标不变，见 [TASK-0006](../07-tasks/active/TASK-0006-lucide-icons.md)。
- 快速开始与开发环境对齐工作区已有的 Wails v3 配置，区分已实现能力与后续邮件功能；保留原始 v2 选型记录并标注差异。
- 多语言底层迁移到 i18next + react-i18next，保留中英文即时切换、离线使用与已有偏好；增加插值、复数及中文回退能力，见 [TASK-0004](../07-tasks/archive/2026/10/TASK-0004-i18n-migration.md) 与 [ADR-0006](../02-architecture/adr/ADR-0006-i18n-framework.md)。

### 修复
- 优化“我的邮箱”账号行与加载失败恢复，修复 IMAP 邮件头兼容、异常流关闭及大批量同步续排，
  保留已成功缓存与真实错误；正文仍按需读取，见 [TASK-0046](../07-tasks/archive/2026/10/TASK-0046-mailbox-sidebar-sync-health.md)。
- 统一应用内悬浮提示的明暗主题、键盘交互、窗口边缘与模态层显示，替换原生黑色 title，
  保留原操作及可访问描述，见 [TASK-0042](../07-tasks/archive/2026/10/TASK-0042-unified-tooltips.md)。
- 修复语言胶囊选中项悬停时继承全局深色按钮背景、造成浅色主题深底深字的问题，见 [TASK-0038](../07-tasks/archive/2026/10/TASK-0038-language-hover-capsule.md)。
- 禁止侧栏分类按钮文字被拖选，保留正常选中滑块和键盘交互，见 [TASK-0020](../07-tasks/active/TASK-0020-sidebar-active-indicator.md)。
- 修正圆形主题动画的残留效果与结束清理时序，防止干扰连续切换，见 [TASK-0022](../07-tasks/active/TASK-0022-theme-transition-reentry.md)。
- 设置中的语言下拉框改为与界面一致的自绘圆角菜单，保留当前语言、选中标记和键盘交互，并处理模态窗滚动区域裁切，见 [TASK-0007](../07-tasks/active/TASK-0007-language-dropdown.md)。

---

## [0.1.0] - 2026-10-15

### 新增
- 项目初始骨架：仓库结构 `desktop/`（Go + React）、`android/`、`ios/`。
- 架构决策记录 ADR-0001（技术栈）、ADR-0002（本地存储）、ADR-0004（凭据存储）状态为已生效；
  ADR-0003（FTS5 搜索）、ADR-0005（HTML 沙箱）为草稿待评审。
- 功能设计文档 FEAT-0001 ~ FEAT-0007 起草。

### 已知问题
- SQLite 驱动选型未定（CGO / 纯 Go），影响交叉编译方案。
- 富文本 ↔ 纯文本转换规则未定稿。
- 构建与签名流程尚为文档描述，未实际执行验证。

---

## 记录规范

| 规则 | 说明 |
| --- | --- |
| 面向用户 | 用用户能理解的语言，不写内部函数名 |
| 按影响分类 | 同一版本内按 新增 → 变更 → 修复 → 移除 → 安全 排列 |
| 链接引用 | 功能条目引用 `FEAT-` 或 `TASK-`，缺陷引用 `BUG-` |
| 破坏性变更 | 单独用 `**破坏性**` 标注并说明迁移方式 |
| P0/P1 修复 | 必须记录，并附回归用例编号 |

示例条目：

```markdown
### 修复
- 修复断网后标记已读无法回写的问题（`BUG-20261020-03`，回归：`TC-SYNC-007`）
```
