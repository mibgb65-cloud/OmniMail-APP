# 变更日志

> 状态：已生效 | 最后更新：2026-10-31

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](../00-guidelines/git-conventions.md#4-版本号semver)。

分类：`新增` / `变更` / `修复` / `移除` / `安全` / `已知问题`。

---

## [未发布]

### 新增
- 增加 LINUX DO Mail 服务商与本地官方品牌图标，预设 `mail.linux.do` 的 IMAP 993 / SMTP 465 TLS，
  完整邮箱用户名、专用令牌提示与严格域名识别；图标来源及哈希随资源记录，
  不将论坛 OAuth 冒充邮件认证。详见 [TASK-0059](../07-tasks/archive/2026/10/TASK-0059-mail-provider-integration.md)。
- 邮件正文成功展示后自动回写对应服务商的 IMAP 已读标记，确认后更新本地与未读计数，
  保留快切/后台/读取失败保护、手动未读优先与失败提示；本地 TLS 服务的独立连接核对已通过，
  真实 QQ 等服务商网页同步尚待账号验收，见
  [TASK-0053](../07-tasks/archive/2026/10/TASK-0053-reader-switch-transition.md)。
- TASK-0053 续作：工具栏接通已读/未读、已加载筛选结果的批量已读、服务端归档与移入垃圾箱，
  新增未读/已确认附件组合筛选、已加载邮件时间正倒序和一致的前后导航。
  HTML 正文支持跟随暗色与恢复原始配色；切换统一实色流光骨架，不再混显旧邮件。
  移动要求唯一目标文件夹与 MOVE/UIDPLUS，不支持时明确提示，不降级 EXPUNGE；
  附件筛选暂仅覆盖已下载正文中的非内嵌附件。已审阅、提交并归档，详见
  [TASK-0053](../07-tasks/archive/2026/10/TASK-0053-reader-switch-transition.md)。
- 邮件阅读支持安全 HTML、表格和内嵌图片，设置提供图片显示策略；
  外链打开前需当次安全确认，星标可独立操作并持久保存，见
  [TASK-0048](../07-tasks/archive/2026/10/TASK-0048-rich-mail-reader.md)、
  [TASK-0049](../07-tasks/archive/2026/10/TASK-0049-mail-reader-interactions.md)。
- 增加应用授权码账号添加、系统凭据适配、TLS IMAP/SMTP 认证、邮件正文与流式附件缓存、后台轮询、手动同步及纯文本发送；本轮基础闭环已提交归档，见 [TASK-0032](../07-tasks/archive/2026/10/TASK-0032-mail-account-integration.md)；未实现/未验证项保留在 [TASK-0037](../07-tasks/active/TASK-0037-mail-advanced-followups.md)，不含 OAuth、IDLE、草稿自动保存或发送附件。
- 新增 SQLite 账号存储基础：版本校验迁移、多服务商预设、独立 IMAP/SMTP 配置及内部账号仓储，应用启动/关闭接入数据库；尚未实现账号接入 UI、系统凭据保存或真实收发信，见 [TASK-0030](../07-tasks/archive/2026/10/TASK-0030-account-storage-foundation.md)。
- 邮件区域增加通栏搜索与邮件操作工具条，下方采用列表和内容双列布局；当前仅 UI 预览，见 [TASK-0024](../07-tasks/active/TASK-0024-mail-workspace-toolbar.md)。
- 分类标题后增加同步时间与未读邮件状态气泡，当前显示未接入数据的占位状态，见 [TASK-0023](../07-tasks/active/TASK-0023-mail-status-bubbles.md)。
- 建立 `desktop/docs` 九大分区文档骨架（45 份文档），覆盖规范、产品、架构、设计、开发、测试、发布、任务与历史。
- 补充根目录启动入口，完成现有桌面骨架的依赖安装与本地质量检查；实际验收范围见 [TASK-0002](../07-tasks/active/TASK-0002-project-skeleton.md)。
- 桌面工作台支持简体中文和英语，提供即时切换、系统语言识别及本地偏好保存；语言包按公共、导航、工作台和连接面板拆分，附一致性校验与接入约定。

### 变更
- TASK-0056～0060 经本地完整门禁后，通过受保护分支
  [PR #1](https://github.com/mibgb65-cloud/OmniMail-APP/pull/1) 正常 Squash 合入 dev，
  远端代码提交 `95e3480e0a944bfa98080b73cb8a142198e66d24`，源实现 `67b2bc3`；
  主分支与 test 未推送，未绕过分支保护或改写历史，真实结果见
  [TASK-0060](../07-tasks/archive/2026/10/TASK-0060-sync-stability-dev-delivery.md)。
- 网易 163 / 126 合并为一个“网易邮箱”选择入口，单个或混合批次按每个完整地址选择对应真实预设；
  兼容旧账号代码与已保存端点，不迁移数据库，不把未确认的 162 域名映射到 126，
  详见 [TASK-0059](../07-tasks/archive/2026/10/TASK-0059-mail-provider-integration.md)。
- 后台同步会自动补齐未打开邮件及历史摘要记录的文字/HTML 正文，事务保存到 SQLite，
  不再只在点击阅读时下载；完整同步完成条件包括正文待办清空。
  图片/附件仍使用文件与数据库引用，外部图片不自动加载；正文下载不标已读，预算让出后可恢复。
  沿用既有大小/格式、服务器删除与 UIDVALIDITY 政策，不宣称无限制或永久归档，
  详见 [TASK-0058](../07-tasks/archive/2026/10/TASK-0058-offline-mail-persistence.md)。
- 未读筛选采用本轮成员快照：阅读仍自动标为已读并更新真实状态、未读计数，
  但不会把读过的邮件立即移出本轮列表，保持选中位置及前后导航。
  主动同步或切换搜索/筛选条件才重新筛选；排序、后台轮询和内部重验不重置本轮成员。
  分页仍可加入新匹配项，明确归档/删除仍移除目标，详见
  [TASK-0057](../07-tasks/archive/2026/10/TASK-0057-stable-unread-filter.md)。
- TASK-0051～0054 已经用户审阅通过并于 2026-10-31 完成本地提交与归档，
  实现提交 `bf283e41c46abe508333eac6b366c5e9d0ba85d3`。完整本地门禁通过，
  包含 59 个前端文件/532 项用例、全部 Go 测试和 Windows 构建；未推送，
  真实服务商网页、macOS 与已披露的观察项仍保留在任务记录中，不作为已验证能力。
- 移除 HTML 邮件正文外层额外添加的边线与圆角，保留邮件自身排版、表格边线及阅读安全策略，
  详见 [TASK-0053](../07-tasks/archive/2026/10/TASK-0053-reader-switch-transition.md)。
- 移除邮件阅读区的“查看原始配色”按钮，将正文配色控制移至
  “设置 → 通用设置 → 语言与外观”的“邮件正文跟随暗色模式”开关；
  默认开启、即时生效并本机持久化，关闭后保留 HTML 原始配色，不重载正文或改变图片许可，
  详见 [TASK-0053](../07-tasks/archive/2026/10/TASK-0053-reader-switch-transition.md)。
- 邮件加载骨架随阅读区高度铺满，并在高窗口补充下半段占位；正文就绪后按标题、
  邮件信息、正文段落和附件自上而下错峰入场，保留减少动态、快切取消与长邮件单滚动区，
  详见 [TASK-0053](../07-tasks/archive/2026/10/TASK-0053-reader-switch-transition.md)。
- 邮件列表优化发件人/日期/两行主题与状态层级；同步进度移至工具栏按钮，
  正文与星标使用独立有界前台通道，不因后台同步而取消或等待账号空闲；
  旧同步快照不得覆盖新星标。已验收提交 `771619c`，
  见 [TASK-0047](../07-tasks/archive/2026/10/TASK-0047-mail-list-visual-hierarchy.md)、
  [TASK-0050](../07-tasks/archive/2026/10/TASK-0050-foreground-mail-concurrency.md)。
- 完成邮箱服务商本地域名识别、品牌图标和账号四步向导；支持同服务商最多 10 个账号串行添加、
  内联校验、原位单面板编辑与失败项重试，见 [TASK-0041](../07-tasks/archive/2026/10/TASK-0041-account-provider-detection.md)、
  [TASK-0043](../07-tasks/archive/2026/10/TASK-0043-shared-dialog-frame.md)、
  [TASK-0044](../07-tasks/archive/2026/10/TASK-0044-same-provider-batch.md)。
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
- 修复完整邮件缺失顶层 MIME 终结边界时正文无法保存的问题：只补经标准库校验的结构分隔符，
  不补造文字或编码数据；IMAP literal 长度、传输中断、FETCH 完成确认和正文/附件预算仍严格检查。
  Gmail 等 IMAP 认证前遇到瞬时 TLS/问候断线时可取消地重试一次，
  证书、认证及写操作不自动重试，并细化安全诊断，见
  [TASK-0060](../07-tasks/archive/2026/10/TASK-0060-sync-stability-dev-delivery.md)。
- 修复网易邮箱认证后因 EXAMINE 缺少 UIDNEXT 而中断同步：通过标准 STATUS 补取，
  必要时以只读 UID SEARCH 的已有集合确定本轮读取上界；不编造 UIDVALIDITY，
  冲突、拒绝、溢出仍报错，并保留旧 UID 范围核对，
  详见 [TASK-0059](../07-tasks/archive/2026/10/TASK-0059-mail-provider-integration.md)。
- 修复 Gmail 同步将 `[Gmail]` / `[Google Mail]` 虚拟分组当成邮箱选择、
  收到 NONEXISTENT 后中断的问题；仅在服务器声明 Gmail 扩展时应用兼容过滤，
  保留真实子文件夹和其他服务器的同名邮箱，同时遵循 NonExistent 隐含 NoSelect 的标准规则。
  同步日志补充白名单服务商、标准拒绝码和公共分组类别，不记录私密文件夹名或服务器原文；
  本轮未清空缓存，详见 [TASK-0056](../07-tasks/archive/2026/10/TASK-0056-gmail-mailbox-sync.md)。
- 修复 Gmail 添加时 IMAP 已认证成功、却因关闭验证连接报错而中止的问题；
  SMTP AUTH 成功后的 QUIT 清理失败同样不再推翻验证结果，SMTP 拒绝和取消仍阻止保存。
  兼容应用密码的普通分组空格，区分认证、网络、TLS 与协议错误，补充中英文指引和
  不含账号、凭据或服务器原文的阶段诊断。用户已确认真实 Gmail 添加完成，未据此宣称
  全部邮件同步或实际发送通过；已本地提交并归档，实现提交
  `55815d1db730fe94a6612bdfd33ec447e63f7f60`，详见
  [TASK-0055](../07-tasks/archive/2026/10/TASK-0055-gmail-account-connection.md)。
- 修复邮件工具栏图标按钮在悬浮时被全局主按钮底色覆盖的问题；
  全局按钮默认状态移入低优先级基础层，工具栏采用共享 ghost/secondary 变体，
  保留明暗主题、按下/禁用/键盘焦点及主按钮状态，见
  [TASK-0053](../07-tasks/archive/2026/10/TASK-0053-reader-switch-transition.md)。
- 标准弹窗补充外框/遮罩同步退出动效，快速关闭不跳帧，保留减少动效、即时取消和发送保护，
  见 [TASK-0045](../07-tasks/archive/2026/10/TASK-0045-dialog-exit-motion.md)。
- 开发期语言资源热更新保留语言、表单与实例，避免新增键仅显示键名，见
  [TASK-0043](../07-tasks/archive/2026/10/TASK-0043-shared-dialog-frame.md)。
- 优化“我的邮箱”账号行与加载失败恢复，修复 IMAP 邮件头兼容、异常流关闭及大批量同步续排，
  保留已成功缓存与真实错误；正文仍按需读取，见 [TASK-0046](../07-tasks/archive/2026/10/TASK-0046-mailbox-sidebar-sync-health.md)。
- 统一应用内悬浮提示的明暗主题、键盘交互、窗口边缘与模态层显示，替换原生黑色 title，
  保留原操作及可访问描述，见 [TASK-0042](../07-tasks/archive/2026/10/TASK-0042-unified-tooltips.md)。
- 修复语言胶囊选中项悬停时继承全局深色按钮背景、造成浅色主题深底深字的问题，见 [TASK-0038](../07-tasks/archive/2026/10/TASK-0038-language-hover-capsule.md)。
- 禁止侧栏分类按钮文字被拖选，保留正常选中滑块和键盘交互，见 [TASK-0020](../07-tasks/active/TASK-0020-sidebar-active-indicator.md)。
- 修正圆形主题动画的残留效果与结束清理时序，防止干扰连续切换，见 [TASK-0022](../07-tasks/active/TASK-0022-theme-transition-reentry.md)。
- 设置中的语言下拉框改为与界面一致的自绘圆角菜单，保留当前语言、选中标记和键盘交互，并处理模态窗滚动区域裁切，见 [TASK-0007](../07-tasks/active/TASK-0007-language-dropdown.md)。

### 已知问题
- 后台完整正文补齐仍受现有格式/大小/时间预算限制，首次历史下载可能较久；
  QQ 已观察到的缺失 MIME 终结边界已由 TASK-0060 修复，网易缺 UIDNEXT 已由 TASK-0059 修复。
  QQ/Gmail 当前持续分批补齐，尚未审计所有历史邮件；后续格式/网络失败仍可见，不影响此前已入库正文。详见
  [TASK-0058](../07-tasks/archive/2026/10/TASK-0058-offline-mail-persistence.md) 和
  [TASK-0037](../07-tasks/active/TASK-0037-mail-advanced-followups.md)。
- 账号添加修复后的后台曾出现“其他文件夹选择被服务器拒绝”
  （`MAIL_PROTOCOL_FAILED / select / other / command_no`），安全日志不足以归因到具体账号；
  已转交 [TASK-0037](../07-tasks/active/TASK-0037-mail-advanced-followups.md) 后续清单，
  不作为 Gmail 添加修复已解决的同步能力。后续
  [TASK-0056](../07-tasks/archive/2026/10/TASK-0056-gmail-mailbox-sync.md) 已定位并修复其中 Gmail 虚拟分组分支，
  其他服务商及完整同步验收边界继续保留。

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
