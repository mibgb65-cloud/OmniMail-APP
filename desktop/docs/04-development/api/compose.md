# Compose API

> 状态：草稿 | 负责人：@backend-lead | 最后更新：2026-10-15
> 相关：[FEAT-0003](../../01-product/features/FEAT-0003-compose-send.md) · [撰写页设计](../../03-design/pages/compose.md)

---

## Compose.Save

```ts
Save(draft: DraftInput): Promise<SaveResult>
```

```ts
interface DraftInput {
  id?: string | null;            // null = 新建
  accountId: string;
  inReplyTo?: string | null;
  references?: string[];
  to: Contact[];
  cc: Contact[];
  bcc: Contact[];
  subject: string;
  bodyText: string;              // 唯一可信正文来源
  bodyHtml?: string | null;      // 可选富文本
  attachments?: string[];        // 已暂存附件 ID
  version?: number;              // 乐观锁：更新时必填
}

interface SaveResult {
  id: string;
  version: number;
  savedAt: number;
}
```

错误：`VALIDATION`（无 accountId、附件超限）、`CONFLICT`（version 不匹配）、`STORAGE`。

## Compose.Send

```ts
Send(id: string): Promise<SendResult>

interface SendResult {
  queued: boolean;               // true = 进入队列（离线/延时）
  messageId?: string;            // 已发出时返回
  scheduledAt?: number | null;
}
```

- 校验：收件人非空、附件总量 ≤ 25MB、账号已启用。
- 发送失败分类映射：`SMTP_AUTH → AUTH_INVALID`、`SMTP_TEMP → NETWORK`（入队重试）、
  `SMTP_PERM → VALIDATION`（转回草稿并说明）。
- 幂等：同一草稿重复 `Send` 不会产生重复邮件（Message-ID 复用 + Sent 去重）。

## Compose.ListDrafts

```ts
ListDrafts(accountId?: string | null): Promise<DraftSummary[]>

interface DraftSummary {
  id: string;
  accountId: string;
  subject: string;
  toSummary: string;             // "A, B 等 2 人"
  updatedAt: number;
  version: number;
  hasAttachments: boolean;
}
```

## Compose.Discard

```ts
Discard(id: string): Promise<void>
```

删除草稿及其历史版本；若草稿已在服务器存在副本，排队删除服务器草稿（失败不影响本地结果）。

## 自动保存节奏（前端职责）

| 条件 | 行为 |
| --- | --- |
| 内容变化且停顿 ≥ 2s | 调用 `Save` |
| 每 60s 且有未保存变化 | 强制 `Save` |
| 关闭/切换草稿 | 同步 `Save` 后再继续 |
| `Save` 失败 | 指数退避重试（1s/3s/10s），状态显示"保存失败（重试）" |

## 示例

```ts
const saved = await bridge.compose.save({
  accountId: 'ACCOUNT_ID',
  to: [{ name: '', addr: 'TARGET@example.com' }],
  cc: [], bcc: [],
  subject: '标题',
  bodyText: '正文内容',
});

const r = await bridge.compose.send(saved.id);
if (r.queued) toast.info('已加入发送队列，将在联网后发出');
```

## 注意

- `bodyText` 与 `bodyHtml` 同时存在时，以 `bodyText` 为准做纯文本发送；`bodyHtml` 仅在用户
  明确选择富文本模式时使用。
- 附件先经 `attachment/put`（内部方法）暂存后再引用；已引用附件不得被缓存清理删除。
