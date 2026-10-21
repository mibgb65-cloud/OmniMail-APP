# FEAT-0005 本地搜索

> 状态：草稿 | 负责人：@backend-lead | 最后更新：2026-10-15
> 需求：[FR-04-*](../requirements.md) | 相关：[ADR-0003 SQLite FTS5](../../02-architecture/adr/ADR-0003-sqlite-fts5.md)

---

## 1. 背景与目标

搜索是本地优先的核心价值。目标：1 万封邮件规模下 P95 ≤ 120ms；跨账号一次查询；
中文与英文混合可用；结果可解释（为什么命中）。

## 2. 用户故事

- 我在搜索框输入"发票 2025"，立刻看到所有账号中相关的邮件。
- 我输入 `from:zhang@example.com has:attachment` 精确收窄。
- 搜索时列表实时更新，不需要回车。

## 3. 交互流程

```
搜索框（Ctrl/Cmd+K 聚焦）
  -> 输入停顿 150ms 触发查询
  -> 结果按相关度 + 时间混合排序
  -> 高亮命中片段（subject / snippet 中的 <mark>）
  -> Esc 清空并返回原列表
  -> 高级语法错误时：不报错，降级为整串字面量搜索 + 提示
```

## 4. 索引设计

```sql
-- 见 02-architecture/database/schema.md
CREATE VIRTUAL TABLE mail_fts USING fts5(
  subject, body_text, from_addr, to_addr, attachment_names,
  content='', tokenize='unicode61 remove_diacritics 2'
);
```

- 外部内容表（`content=''`），由应用在写入/更新邮件时同步维护。
- 正文索引仅存**纯文本**，去 HTML 标签，单条截断 200KB（超出部分不入索引，保留原文）。
- 中文：`unicode61` 不切词，采用**应用层二元（bigram）注入**：写入时在 `body_text` 尾部追加
  `zh_bigram` 列内容；查询时对中文串同样二元切分后用 `OR` 连接。见 ADR-0003。
- 增量维护：同步引擎在邮件落库后调用 `search.Index(mailID)`；删除走 `mail_fts` 的 `'delete'` 指令。

## 5. 查询语法

| 语法 | 语义 | 示例 |
| --- | --- | --- |
| `from:` | 发件人包含 | `from:zhang` |
| `to:` | 收件人包含 | `to:@example.com` |
| `subject:` | 主题包含 | `subject:周报` |
| `has:attachment` | 有附件 | `has:attachment` |
| `after:` / `before:` | 日期范围 | `after:2025-01-01` |
| `account:` | 限定账号 | `account:ACCOUNT_ID` |
| `"..."` | 精确短语 | `"季度 报告"` |
| `-词` | 排除 | `发票 -退款` |

解析器产出 AST，再编译为 FTS5 MATCH + SQL 过滤条件；不允许字符串拼接到 SQL，一律参数化。

## 6. 接口

```ts
interface SearchAPI {
  query(input: {
    text: string;
    accountIds?: string[];
    mailboxes?: MailboxKind[];
    limit?: number;      // 默认 50，上限 200
  }): Promise<SearchResult>;
}

interface SearchHit {
  mailId: string;
  accountId: string;
  subject: string;
  snippet: string;     // 带 <mark> 的高亮片段
  matchedFields: string[];
  receivedAt: string;
  score: number;
}

interface SearchResult {
  hits: SearchHit[];
  total: number;
  elapsedMs: number;
  degraded: boolean;   // 语法解析失败降级
}
```

## 7. 排序

`score = 0.7 * bm25_normalized + 0.3 * recency_decay(received_at, 90d)`

- 限定账号/时间等强过滤条件时，提高时间权重。
- 排序稳定：同分按 `received_at DESC, id ASC`。

## 8. 验收标准

- [ ] 1 万封（含 20% 中文）索引构建 < 60s，后续增量 < 50ms/封。
- [ ] 查询 P95 ≤ 120ms，P99 ≤ 250ms。
- [ ] 中文"季度报告"能命中"季度报告"与"季度 报告"。
- [ ] 语法错误输入（如 `from:`）不报错，返回整串搜索并标记 `degraded`。
- [ ] 删除邮件后 1 次同步周期内不再出现在结果中。
- [ ] 索引重建（`rebuild` 命令）在后台执行，UI 不得卡死。

## 9. 非目标

- v1 不做语义/向量搜索。
- v1 不索引附件内容（仅文件名）。
- 不做搜索历史云同步。

## 10. 风险与开放问题

- 二元分词会让中文索引体积约为正文 1.5-2 倍，需评估磁盘占用（100 万封场景）。
- 是否引入第三方中文分词库（如 gojieba）以提升精度？——ADR-0003 中权衡。
- 正文截断 200KB 可能导致长邮件尾部不可搜，需在 UI 提示。
