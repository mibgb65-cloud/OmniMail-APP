# 数据库 Schema

> 状态：草稿 | 负责人：@backend-lead | 最后更新：2026-10-15 | Schema 版本：v1
> 相关：[数据库设计](README.md) · [迁移](migrations.md)

> 历史草稿说明（2026-10-27）：本文 DDL 从未作为生产迁移落地，其中 Message-ID 唯一、
> 邮件标志位、FTS rowid 等设计不能直接执行或照搬。当前版本只实现账号存储，真实结构见
> [当前 Schema](schema-current.md) 与内置 SQL 迁移；后续邮件规则见 [实施设计](account-storage.md)。

---

## 1. 初始化 PRAGMA

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous  = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA temp_store   = MEMORY;
```

## 2. DDL（v1）

```sql
-- ===== 账号 =====
CREATE TABLE account (
  id             TEXT PRIMARY KEY,              -- ULID
  email          TEXT NOT NULL,
  display_name   TEXT NOT NULL DEFAULT '',
  provider       TEXT NOT NULL DEFAULT 'custom',-- gmail|outlook|qq|163|icloud|custom
  auth_kind      TEXT NOT NULL DEFAULT 'password', -- password|oauth2
  credential_ref TEXT NOT NULL,                 -- 钥匙串条目名，不含密文
  enabled        INTEGER NOT NULL DEFAULT 1,
  color_index    INTEGER NOT NULL DEFAULT 0,    -- 0..5，UI 着色
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  UNIQUE(email, provider)
);

-- ===== 文件夹 =====
CREATE TABLE mailbox (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  remote_name TEXT NOT NULL,         -- 服务器原始名，如 "[Gmail]/All Mail"
  kind        TEXT NOT NULL,         -- inbox|sent|drafts|trash|archive|spam|other
  display     TEXT NOT NULL DEFAULT '',
  delimiter   TEXT NOT NULL DEFAULT '/',
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_mailbox_account ON mailbox(account_id, sort_order);
CREATE UNIQUE INDEX ux_mailbox_remote ON mailbox(account_id, remote_name);

-- ===== 会话 =====
CREATE TABLE thread (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  normalized_subject TEXT NOT NULL,  -- 去 Re:/Fwd: 与列表标签后的主题
  last_mail_id TEXT,
  message_count INTEGER NOT NULL DEFAULT 1,
  unread_count  INTEGER NOT NULL DEFAULT 0,
  last_at      INTEGER NOT NULL
);
CREATE INDEX idx_thread_last ON thread(account_id, last_at DESC);

-- ===== 邮件 =====
CREATE TABLE mail (
  id            TEXT PRIMARY KEY,          -- ULID
  account_id    TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  thread_id     TEXT REFERENCES thread(id) ON DELETE SET NULL,
  message_id    TEXT NOT NULL,             -- RFC 5322 Message-ID
  in_reply_to   TEXT,
  references    TEXT,                      -- 空格分隔
  subject       TEXT NOT NULL DEFAULT '',
  from_name     TEXT NOT NULL DEFAULT '',
  from_addr     TEXT NOT NULL DEFAULT '',
  to_json       TEXT NOT NULL DEFAULT '[]',-- [{name,addr}]
  cc_json       TEXT NOT NULL DEFAULT '[]',
  snippet       TEXT NOT NULL DEFAULT '',  -- 纯文本前 120 字
  body_text     TEXT,                      -- 纯文本正文（可空，按需加载）
  body_path     TEXT,                      -- 超 1MB 正文存文件
  body_size     INTEGER NOT NULL DEFAULT 0,
  received_at   INTEGER NOT NULL,          -- Unix ms
  sent_at       INTEGER,
  has_attachment INTEGER NOT NULL DEFAULT 0,
  is_read       INTEGER NOT NULL DEFAULT 0,
  is_starred    INTEGER NOT NULL DEFAULT 0,
  is_flagged    INTEGER NOT NULL DEFAULT 0, -- 服务器 \$Flagged
  is_answered   INTEGER NOT NULL DEFAULT 0,
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  deleted_at    INTEGER,                   -- 软删除
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_mail_account_received ON mail(account_id, received_at DESC, id);
CREATE INDEX idx_mail_thread ON mail(thread_id, received_at);
CREATE INDEX idx_mail_flags ON mail(account_id, is_read, is_starred);
CREATE UNIQUE INDEX ux_mail_message ON mail(account_id, message_id);

-- ===== 邮件 ↔ 文件夹 =====
CREATE TABLE mail_mailbox (
  mail_id    TEXT NOT NULL REFERENCES mail(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  mailbox_id TEXT NOT NULL REFERENCES mailbox(id) ON DELETE CASCADE,
  uid        INTEGER NOT NULL,
  mod_seq    INTEGER,
  PRIMARY KEY (mail_id, mailbox_id)
);
CREATE UNIQUE INDEX ux_mailbox_uid ON mail_mailbox(account_id, mailbox_id, uid);
CREATE INDEX idx_mm_mailbox ON mail_mailbox(mailbox_id, uid DESC);

-- ===== 附件 =====
CREATE TABLE attachment (
  id        TEXT PRIMARY KEY,
  mail_id   TEXT NOT NULL REFERENCES mail(id) ON DELETE CASCADE,
  filename  TEXT NOT NULL,
  mime      TEXT NOT NULL,
  size      INTEGER NOT NULL,
  sha256    TEXT NOT NULL,
  path      TEXT NOT NULL,        -- 相对 attachments 根目录
  is_inline INTEGER NOT NULL DEFAULT 0,
  content_id TEXT                  -- cid，用于内嵌图片
);
CREATE INDEX idx_att_mail ON attachment(mail_id);
CREATE INDEX idx_att_sha ON attachment(sha256);

-- ===== 全文索引 =====
CREATE VIRTUAL TABLE mail_fts USING fts5(
  subject, body_text, from_addr, to_addr, attachment_names,
  content='',
  tokenize='unicode61 remove_diacritics 2'
);

-- ===== 同步游标 =====
CREATE TABLE sync_state (
  account_id    TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  mailbox_id    TEXT NOT NULL REFERENCES mailbox(id) ON DELETE CASCADE,
  uid_validity  INTEGER NOT NULL DEFAULT 0,
  uid_next      INTEGER NOT NULL DEFAULT 0,
  highest_mod_seq INTEGER NOT NULL DEFAULT 0,
  last_sync_at  INTEGER,
  last_error    TEXT,
  PRIMARY KEY (account_id, mailbox_id)
);

-- ===== 离线操作队列 =====
CREATE TABLE pending_op (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,   -- mark_read|set_star|move|delete|append_draft|send
  payload    TEXT NOT NULL,   -- JSON
  attempts   INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  not_before INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_pending_due ON pending_op(account_id, not_before, created_at);

CREATE TABLE failed_op (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  kind       TEXT NOT NULL,
  payload    TEXT NOT NULL,
  error      TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- ===== 草稿 =====
CREATE TABLE draft (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  in_reply_to TEXT,
  references  TEXT,
  to_json     TEXT NOT NULL DEFAULT '[]',
  cc_json     TEXT NOT NULL DEFAULT '[]',
  bcc_json    TEXT NOT NULL DEFAULT '[]',
  subject     TEXT NOT NULL DEFAULT '',
  body_text   TEXT NOT NULL DEFAULT '',
  body_html   TEXT,
  version     INTEGER NOT NULL DEFAULT 1,
  is_sent     INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_draft_account ON draft(account_id, updated_at DESC);

CREATE TABLE draft_version (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id   TEXT NOT NULL REFERENCES draft(id) ON DELETE CASCADE,
  version    INTEGER NOT NULL,
  payload    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX ux_draft_version ON draft_version(draft_id, version);

-- ===== 地址补全缓存 =====
CREATE TABLE contact_cache (
  account_id TEXT NOT NULL,
  addr       TEXT NOT NULL,
  name       TEXT NOT NULL DEFAULT '',
  freq       INTEGER NOT NULL DEFAULT 1,
  last_used  INTEGER NOT NULL,
  PRIMARY KEY (account_id, addr)
);

-- ===== 设置与迁移 =====
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE schema_migration (
  version    INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL,
  checksum   TEXT NOT NULL
);
```

## 3. 常用查询

### 统一收件箱分页

```sql
SELECT m.id, m.account_id, a.display_name AS account_label, a.color_index,
       m.subject, m.snippet, m.from_addr, m.received_at,
       m.is_read, m.is_starred, m.has_attachment, m.thread_id
FROM mail m
JOIN account a ON a.id = m.account_id
JOIN mail_mailbox mb ON mb.mail_id = m.id
JOIN mailbox bx ON bx.id = mb.mailbox_id
WHERE m.deleted_at IS NULL
  AND a.enabled = 1
  AND bx.kind = 'inbox'
  AND (?1 IS NULL OR m.account_id = ?1)
  AND (?2 IS NULL OR (m.received_at, m.id) < (?2, ?3))
ORDER BY m.received_at DESC, m.id DESC
LIMIT ?4;
```

### 未读数

```sql
SELECT account_id, COUNT(*) AS unread
FROM mail WHERE is_read = 0 AND deleted_at IS NULL
GROUP BY account_id;
```

### FTS 检索 + 过滤

```sql
SELECT m.id, snippet(mail_fts, 1, '<mark>', '</mark>', '…', 12) AS snip, bm25(mail_fts) AS score
FROM mail_fts f
JOIN mail m ON m.id = f.rowid
WHERE mail_fts MATCH ?1
  AND (?2 IS NULL OR m.account_id = ?2)
  AND m.deleted_at IS NULL
ORDER BY score LIMIT ?3;
```

## 4. 不变量（必须由代码或约束保证）

1. `mail(account_id, message_id)` 唯一；重复投递不新增行，只更新文件夹映射。
2. `mail_mailbox(account_id, mailbox_id, uid)` 唯一；`UIDVALIDITY` 变化时整体替换该文件夹行。
3. `draft.version` 单调递增，保存必须携带期望版本（乐观锁）。
4. `deleted_at` 非空的行不出现在任何列表查询中，但保留 FTS 条目直到物理删除。
5. `sync_state` 每 `(account, mailbox)` 至多一行。
