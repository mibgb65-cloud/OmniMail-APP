# Mail API

> 状态：草稿 | 负责人：@backend-lead | 最后更新：2026-10-15
> 相关：[FEAT-0002](../../01-product/features/FEAT-0002-unified-inbox.md) · [MailRow 设计](../../03-design/components/mail-row.md)

---

## Mail.Page

```ts
Page(q: MailQuery): Promise<MailPage>
```

```ts
interface MailQuery {
  accountId?: string | null;     // null = 全部启用账号
  mailbox?: MailboxKind | null;  // null = 全部（仅统一收件箱场景用 inbox）
  mailboxName?: string | null;   // 指定服务器文件夹（如 '[Gmail]/All Mail'）
  onlyUnread?: boolean;
  onlyStarred?: boolean;
  hasAttachment?: boolean;
  limit?: number;                // 默认 50，上限 200
  cursor?: string | null;        // 上一页返回的 nextCursor
}

type MailboxKind = 'inbox' | 'sent' | 'drafts' | 'trash' | 'archive' | 'spam' | 'other';

interface MailPage {
  items: MailListItem[];
  nextCursor: string | null;
  total: number | null;          // 近似值，可能为 null
}
```

`MailListItem` 字段见 [前端数据流](../../02-architecture/frontend/data-flow.md) 与 [FEAT-0002](../../01-product/features/FEAT-0002-unified-inbox.md#4-数据结构与接口影响)。

排序：`receivedAt DESC, id DESC`。游标是不透明字符串（当前实现为 `base64(receivedAt:id)`），前端不得解析。

## Mail.GetBody

```ts
GetBody(id: string): Promise<MailBody>
```

```ts
interface MailBody {
  id: string;
  subject: string;
  from: Contact;
  to: Contact[];
  cc: Contact[];
  bcc: Contact[];
  receivedAt: number;
  html: string;                  // 已清洗的 HTML（见 FEAT-0007），可能为空
  text: string;                  // 纯文本回退
  attachments: AttachmentMeta[];
  inlineCount: number;           // 内嵌图片数（cid）
  blockedRemoteCount: number;    // 被阻止的远程资源数，>0 时显示安全条
  thread: { id: string; messageCount: number } | null;
}

interface Contact { name: string; addr: string; }
interface AttachmentMeta {
  id: string;
  filename: string;
  mime: string;
  size: number;
  isInline: boolean;
  contentId: string | null;
  localPath: string | null;      // 已下载时提供（前端仅用于下载动作，不直接读文件）
}
```

错误：`NOT_FOUND`（已被删除/未同步到正文）、`STORAGE`。

## Mail.SetRead / SetStarred

```ts
SetRead(ids: string[], read: boolean): Promise<FlagResult>
SetStarred(ids: string[], starred: boolean): Promise<FlagResult>

interface FlagResult { applied: number; queued: number; failed: string[] }
```

- 本地立即更新并返回；服务器回写进入 `pending_op`，`queued` 为入队数量。
- `failed` 为无法处理的 ID（已删除等）。

## Mail.Move

```ts
Move(ids: string[], target: MailboxKind): Promise<FlagResult>
```

- `target='archive'` 时映射到服务商对应的归档文件夹（Gmail: `[Gmail]/All Mail` 并移除 INBOX）。
- `target='trash'` 若服务商无 Trash 文件夹，退化为删除标记。

## Mail.Delete

```ts
Delete(ids: string[], permanent?: boolean): Promise<void>
```

- 默认软删除（进 trash，可撤销 8 秒）。
- `permanent=true`：本地立即移除并排队服务器 `EXPUNGE`；不可撤销。

## 事件交互

| 动作 | 发出的事件 |
| --- | --- |
| 同步拉到新邮件 | `mail:new { accountId, count }` |
| 回写成功/失败 | `mail:updated { ids, patch }` |
| 永久失败 | `ops:failed { accountId, kind, message }` |

## 示例

```ts
const page = await bridge.mail.page({ accountId: null, mailbox: 'inbox', limit: 50 });
const body = await bridge.mail.getBody(page.items[0].id);
await bridge.mail.setRead([body.id], true);
```

## 注意

- 批量 ID 上限 200；超出返回 `VALIDATION`，前端应分批调用。
- `GetBody` 可能触发正文按需拉取（未缓存时），此时耗时可达 2s，UI 需先展示骨架。
