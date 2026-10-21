# Search API

> 状态：草稿 | 负责人：@backend-lead | 最后更新：2026-10-15
> 相关：[FEAT-0005 本地搜索](../../01-product/features/FEAT-0005-local-search.md) · [ADR-0003](../../02-architecture/adr/ADR-0003-sqlite-fts5.md)

---

## Search.Query

```ts
Query(input: SearchInput): Promise<SearchResult>
```

```ts
interface SearchInput {
  text: string;                  // 支持语法，见下
  accountIds?: string[] | null;  // null = 全部启用账号
  mailboxes?: MailboxKind[] | null;
  includeDeleted?: boolean;      // 默认 false
  limit?: number;                // 默认 50，上限 200
  sort?: 'relevance' | 'time';   // 默认 relevance
}

interface SearchResult {
  hits: SearchHit[];
  total: number;
  elapsedMs: number;
  degraded: boolean;             // 语法解析失败降级为字面量
  shortTermWarning: boolean;     // 单字中文，结果可能不完整
}

interface SearchHit {
  mailId: string;
  accountId: string;
  accountLabel: string;
  subject: string;               // 内含 <mark> 高亮
  snippet: string;               // 内含 <mark> 高亮
  fromAddr: string;
  receivedAt: number;
  matchedFields: ('subject'|'body'|'from'|'to'|'attachment')[];
  score: number;                 // 归一化 0..1，仅用于调试展示
}
```

## 查询语法

| 语法 | 示例 | 说明 |
| --- | --- | --- |
| 关键词 | `季度报告` | 分词后 AND（中文按二元） |
| 短语 | `"季度 报告"` | 精确短语 |
| `from:` | `from:zhang@example.com` | 支持部分匹配 |
| `to:` | `to:@example.com` | 域名匹配 |
| `subject:` | `subject:发票` | 仅主题 |
| `has:attachment` | `has:attachment report` | 有附件 |
| `after:` / `before:` | `after:2025-01-01` | 日期，含等号边界 |
| `account:` | `account:ACCOUNT_ID` | 限定账号 |
| `-词` | `发票 -退款` | 排除 |

- 多个条件以空格分隔，语义为 AND。
- 未知前缀视为普通文本（不报错）。

## 高亮规则

- 命中片段长度 120 字符，命中词前后各 40 字上下文。
- 高亮标签固定为 `<mark>`；后端返回的字符串已在服务端转义，前端用白名单方式渲染
  （仅允许 `<mark>`，其余按文本转义），禁止直接 `dangerouslySetInnerHTML`。

## 降级行为

| 情况 | `degraded` | `shortTermWarning` | 结果 |
| --- | --- | --- | --- |
| 语法错误（如 `from:` 空值） | true | false | 整串字面量搜索 |
| 单字中文（如 `票`） | false | true | LIKE 扫描（限当前账号范围） |
| FTS 不可用（索引损坏） | true | false | LIKE 全表扫描（慢，返回提示） |

## 示例

```ts
const r = await bridge.search.query({
  text: 'from:zhang has:attachment after:2025-01-01',
  limit: 50,
});
if (r.shortTermWarning) toast.info('短词结果可能不完整');
```

## 索引维护

| 触发 | 动作 |
| --- | --- |
| 邮件落库 | `Index(mailId)`（同事务后异步写入） |
| 邮件删除（软） | 立即从 FTS 删除 |
| 账号移除 | 批量删除该账号索引行 |
| 手动重建 | 设置 → 维护 → 重建索引（后台任务，期间搜索降级） |

## 性能约束

| 场景 | 目标 |
| --- | --- |
| 1 万封单关键词 | P95 ≤ 120ms |
| 带账号过滤 | P95 ≤ 80ms |
| 索引重建（1 万封） | ≤ 60s |
| 单封索引 | ≤ 50ms |
