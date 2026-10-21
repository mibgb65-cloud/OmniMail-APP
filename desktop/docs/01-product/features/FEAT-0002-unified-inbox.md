# FEAT-0002 统一收件箱

> 状态：草稿 | 负责人：@frontend-lead | 最后更新：2026-10-15
> 需求：[FR-01-4, FR-02-1~3](../requirements.md) | 相关：[FEAT-0004](FEAT-0004-sync-engine.md) · [FEAT-0005](FEAT-0005-local-search.md)

---

## 1. 背景与目标

多账号用户 80% 的时间停留在"所有未读邮件"上。统一收件箱把所有启用账号的收件箱按时间合并，
同时保留账号维度的清晰来源标识，且能一键收窄到单账号。

## 2. 用户故事

- 我打开应用就能看到所有账号的新邮件，按时间排序，不再逐个点开。
- 我能一眼分辨每封邮件属于哪个账号（颜色条 + 账号名）。
- 我能切到单一账号的收件箱，视图状态（滚动位置、选中项）保持。

## 3. 交互流程

```
侧栏：统一收件箱 / 账号A（收件箱 未读 已发送 草稿 垃圾箱）/ 账号B ...
列表：虚拟滚动，按 received_at DESC
详情：右侧或下方分栏；宽屏分栏，窄屏（< 960px）覆盖式
```

- 选中一行 -> 本地标记已读，异步回写服务器（失败回滚并提示）。
- 批量操作：Ctrl/Cmd 多选、Shift 范围选、`a` 全选当前页。
- 空态、加载骨架、错误态、未授权态四态齐备。

## 4. 数据结构与接口影响

```ts
interface MailListItem {
  id: string;              // 本地主键
  accountId: string;
  accountLabel: string;    // 冗余，供列表着色，避免前端 join
  accountColor: string;    // token 名称，如 "account-1"
  threadId: string;
  mailbox: MailboxKind;    // inbox|sent|drafts|trash|archive
  subject: string;
  snippet: string;         // 纯文本前 120 字符
  from: Contact;
  to: Contact[];
  receivedAt: string;      // ISO8601
  isRead: boolean;
  isStarred: boolean;
  hasAttachment: boolean;
  messageCount: number;    // 会话内邮件数
}
```

分页：游标（`receivedAt` + `id`），禁止 offset 分页。

```ts
interface MailListAPI {
  page(q: MailQuery): Promise<{ items: MailListItem[]; nextCursor?: string }>;
  setRead(ids: string[], read: boolean): Promise<void>;
  setStarred(ids: string[], starred: boolean): Promise<void>;
  move(ids: string[], target: MailboxKind): Promise<void>;
  subscribe(handler: (e: MailEvent) => void): () => void;
}
```

`MailEvent` 用于增量更新列表（新邮件、状态变更），避免整页刷新。

## 5. 后端设计要点

- 查询走覆盖索引 `idx_mail_account_time(account_id, received_at DESC, id)`。
- 会话聚合在 `thread` 表上做，列表读 `thread` 的最新一封作为摘要。
- 状态变更先写本地 `pending_ops` 队列，由同步引擎回写（[FEAT-0004 §6](FEAT-0004-sync-engine.md)）。
- 单次返回上限 50 条，最多 200 条；超出要求前端分页。

## 6. 前端设计要点

- 列表虚拟化（固定行高 64px，附件行 80px），1 万条滚动不卡顿。
- `MailEvent` 到达时用不可变更新，保持选中项与滚动位置。
- 账号色条宽度 3px，位于行首；颜色来自 `--color-account-N`（N=1..6 循环）。
- 时间显示：今天显示 `HH:mm`，本年内显示 `M月D日`，跨年显示 `YYYY-MM-DD`。
- 未读行：字号不变，标题 `font-weight: 600` + 左侧 8px 未读点（不只靠颜色传达，满足可访问性）。

## 7. 验收标准

- [ ] 3 账号各 2000 封，切换"统一/单账号"在 200ms 内完成首屏渲染。
- [ ] 新邮件到达后 1s 内出现在列表顶部（IDLE 开启时）。
- [ ] 已读标记离线时立即生效，联网后服务器状态一致。
- [ ] 键盘：`j/k` 移动、`Enter` 打开、`u` 标未读、`s` 星标、`Delete` 删除。
- [ ] 空账号、全部未读为 0 时均有明确空态文案。
- [ ] 分栏切换在 960px 断点无布局跳动。

## 8. 非目标

- v1 不做多级标签视图（仅收藏与系统文件夹）。
- v1 不做正则/自定义视图保存。

## 9. 度量与观测

首屏渲染耗时、列表滚动掉帧率、`MailEvent` 到 UI 更新延迟、状态回写失败率。

## 10. 风险与开放问题

- 超大账号（10 万封）首次加载：需要预置"仅最近 90 天"的默认范围，是否给用户可调？——待评审。
- 会话聚合规则对 mailing list 是否过度合并——需样本验证。
