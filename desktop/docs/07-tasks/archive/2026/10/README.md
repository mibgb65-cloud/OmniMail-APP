# 归档：2026-10

> 状态：已生效 | 最后更新：2026-10-31

本目录存放 **2026 年 10 月** 完成的迭代任务（从 `active/` 移入）。
归档文件不再修改，仅作追溯；后续衍生工作建新任务。

## 本月完成

| 任务 | 标题 | 负责人 | 完成日期 |
| --- | --- | --- | --- |
| [TASK-0001](TASK-0001-docs-skeleton.md) | 文档目录骨架与初始内容 | @arch-lead | 2026-10-15 |
| [TASK-0004](TASK-0004-i18n-migration.md) | 接入 i18next 国际化框架 | @Codex | 2026-10-24 |
| [TASK-0030](TASK-0030-account-storage-foundation.md) | 多服务商账号与邮件存储基础 | @Codex | 2026-10-27 |
| [TASK-0032](TASK-0032-mail-account-integration.md) | 账号接入与邮件收发基础闭环 | @Codex | 2026-10-28 |
| [TASK-0033](TASK-0033-system-credentials.md) | 系统凭据存储主路径 | @Codex | 2026-10-28 |
| [TASK-0034](TASK-0034-mail-protocol-adapters.md) | 邮件协议与 MIME 基础适配 | @Codex | 2026-10-28 |
| [TASK-0035](TASK-0035-mail-persistence.md) | 邮件正文附件与同步状态存储 | @Codex | 2026-10-28 |
| [TASK-0036](TASK-0036-mail-account-ui-service.md) | 账号添加与收发同步基础界面集成 | @Codex | 2026-10-28 |
| [TASK-0038](TASK-0038-language-hover-capsule.md) | 语言切换悬停横向展开胶囊 | @Codex | 2026-10-28 |
| [TASK-0039](TASK-0039-account-provider-selection.md) | 添加邮箱服务商卡片选择页 | @Codex | 2026-10-28 |
| [TASK-0040](TASK-0040-mail-infinite-scroll.md) | 邮件列表无限滚动 | @Codex | 2026-10-28 |
| [TASK-0041](TASK-0041-account-provider-detection.md) | 邮箱输入匹配服务商与品牌图标 | @Codex | 2026-10-30 |
| [TASK-0042](TASK-0042-unified-tooltips.md) | 全局悬浮提示视觉与交互统一 | @Codex | 2026-10-30 |
| [TASK-0043](TASK-0043-shared-dialog-frame.md) | 统一弹窗外框与账号四步向导 | @Codex | 2026-10-30 |
| [TASK-0044](TASK-0044-same-provider-batch.md) | 同服务商多账号批量添加 | @Codex | 2026-10-30 |
| [TASK-0045](TASK-0045-dialog-exit-motion.md) | 标准弹窗退出动效 | @Codex | 2026-10-30 |
| [TASK-0046](TASK-0046-mailbox-sidebar-sync-health.md) | 我的邮箱区域与邮件加载体验 | @Codex | 2026-10-30 |
| [TASK-0047](TASK-0047-mail-list-visual-hierarchy.md) | 邮件列表信息层级与视觉优化 | @Codex | 2026-10-30 |
| [TASK-0048](TASK-0048-rich-mail-reader.md) | 邮件正文与图片安全完整展示 | @Codex | 2026-10-30 |
| [TASK-0049](TASK-0049-mail-reader-interactions.md) | 邮件链接安全交互、同步提示与星标闭环 | @Codex | 2026-10-30 |
| [TASK-0050](TASK-0050-foreground-mail-concurrency.md) | 星标与正文读取不被后台同步阻塞 | @Codex | 2026-10-30 |
| [TASK-0051](TASK-0051-reader-loading-skeleton.md) | 邮件骨架屏、就绪淡入与单一滚动区 | @Codex | 2026-10-31 |
| [TASK-0052](TASK-0052-mail-header-copy.md) | 邮件头信息排版与邮箱复制 | @Codex | 2026-10-31 |
| [TASK-0053](TASK-0053-reader-switch-transition.md) | 阅读体验、邮件操作与服务商自动已读 | @Codex | 2026-10-31 |
| [TASK-0054](TASK-0054-reader-header-star.md) | 标题星标入口与紧凑邮件头 | @Codex | 2026-10-31 |
| [TASK-0055](TASK-0055-gmail-account-connection.md) | Gmail 添加失败诊断、密码兼容与认证错误分类 | @Codex | 2026-10-31 |
| [TASK-0056](TASK-0056-gmail-mailbox-sync.md) | Gmail 文件夹选择失败与同步兼容性 | @Codex | 2026-10-31 |
| [TASK-0057](TASK-0057-stable-unread-filter.md) | 未读筛选会话保持列表位置 | @Codex | 2026-10-31 |
| [TASK-0058](TASK-0058-offline-mail-persistence.md) | 后台正文同步与数据库持久化 | @Codex | 2026-10-31 |
| [TASK-0059](TASK-0059-mail-provider-integration.md) | LinuxDo 与网易邮箱接入及兼容 | @Codex | 2026-10-31 |
| [TASK-0060](TASK-0060-sync-stability-dev-delivery.md) | QQ/Gmail 同步稳定性与 dev 交付 | @Codex | 2026-10-31 |

## 本月取消

| 任务 | 原因 | 替代 |
| --- | --- | --- |
| — | — | — |

## 归档规则

1. 任务文件的状态行改为 `已完成` 或 `已取消`，并补齐"完成记录"。
2. 移动到 `archive/YYYY/MM/`（按**完成月份**）。
3. 同步更新 [active/README.md](../../../active/README.md) 表格。
4. 若影响用户可见行为，在 [changelog](../../../../08-history/changelog.md) 中记录。
