-- +up
ALTER TABLE mailbox ADD COLUMN ai_head_uid INTEGER NOT NULL DEFAULT 0 CHECK(ai_head_uid BETWEEN 0 AND 4294967295);
ALTER TABLE mailbox ADD COLUMN ai_head_known INTEGER NOT NULL DEFAULT 0 CHECK(ai_head_known IN (0,1));
ALTER TABLE mail_message ADD COLUMN ai_body_revision INTEGER NOT NULL DEFAULT 0;
CREATE TABLE task_mail_seen (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    mail_id TEXT NOT NULL UNIQUE REFERENCES mail_message(id) ON DELETE CASCADE
) STRICT;
INSERT INTO task_mail_seen(mail_id) SELECT id FROM mail_message ORDER BY received_at,id;
CREATE TRIGGER task_observe_mail AFTER INSERT ON mail_message BEGIN
    INSERT OR IGNORE INTO task_mail_seen(mail_id) VALUES(NEW.id);
END;
CREATE TRIGGER task_body_revision AFTER UPDATE OF subject,body_text,body_html,body_version,body_error_code ON mail_message
WHEN OLD.subject IS NOT NEW.subject OR OLD.body_text IS NOT NEW.body_text OR OLD.body_html IS NOT NEW.body_html
 OR OLD.body_version IS NOT NEW.body_version OR OLD.body_error_code IS NOT NEW.body_error_code BEGIN
    UPDATE mail_message SET ai_body_revision=OLD.ai_body_revision+1 WHERE id=NEW.id;
END;
CREATE TABLE task_preferences (
    id INTEGER PRIMARY KEY CHECK(id=1),
    value TEXT NOT NULL CHECK(length(value)<=16384)
) STRICT;
CREATE TABLE task_baseline (
    mailbox_id TEXT PRIMARY KEY REFERENCES mailbox(id) ON DELETE CASCADE,
    uid_validity INTEGER NOT NULL,
    baseline_uid INTEGER NOT NULL,
    baseline_seq INTEGER NOT NULL,
    started_at INTEGER NOT NULL
) STRICT;
CREATE TABLE todo_item (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL, title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 1000),
    notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=4096),
    owner TEXT NOT NULL DEFAULT '' CHECK(length(owner)<=200),
    due TEXT NOT NULL DEFAULT '' CHECK(length(due)<=100),
    status TEXT NOT NULL CHECK(status IN ('suggested','open','waiting','done','dismissed')),
    version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_todo_updated ON todo_item(updated_at DESC,id);
-- 来源只保留必要引文；本地邮件同步重建不级联删除用户事项。
CREATE TABLE todo_source (
    id TEXT PRIMARY KEY, todo_id TEXT NOT NULL REFERENCES todo_item(id) ON DELETE CASCADE,
    mail_id TEXT NOT NULL, account_id TEXT NOT NULL, folder TEXT NOT NULL,
    subject TEXT NOT NULL CHECK(length(subject)<=4096),
    evidence TEXT NOT NULL CHECK(length(evidence)<=2000),
    ai_title TEXT NOT NULL CHECK(length(ai_title)<=1000),
    body_revision INTEGER NOT NULL, received_at INTEGER NOT NULL, created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_todo_source_item ON todo_source(todo_id,created_at DESC);
CREATE INDEX idx_todo_source_scope ON todo_source(account_id,created_at DESC);
CREATE TABLE todo_proposal (
    id TEXT PRIMARY KEY, todo_id TEXT NOT NULL REFERENCES todo_item(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES todo_source(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('update','conflict','cancel','complete')),
    title TEXT NOT NULL, owner TEXT NOT NULL, due TEXT NOT NULL, reason TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','accepted','dismissed')), created_at INTEGER NOT NULL
) STRICT;
CREATE TABLE task_run (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('manual','daily')),
    state TEXT NOT NULL, slot TEXT UNIQUE, prefs_revision TEXT NOT NULL,
    retry_unknown INTEGER NOT NULL DEFAULT 0, started_at INTEGER NOT NULL, finished_at INTEGER NOT NULL DEFAULT 0,
    waiting_body INTEGER NOT NULL DEFAULT 0, remaining INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '',
    new_count INTEGER NOT NULL DEFAULT 0, change_count INTEGER NOT NULL DEFAULT 0,
    needs_sync INTEGER NOT NULL DEFAULT 0
) STRICT;
CREATE TABLE task_run_mail (
    run_id TEXT NOT NULL REFERENCES task_run(id) ON DELETE CASCADE, mail_id TEXT NOT NULL, subject TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'queued', error TEXT NOT NULL DEFAULT '', PRIMARY KEY(run_id,mail_id)
) STRICT;
CREATE TABLE task_receipt (
    fingerprint TEXT PRIMARY KEY CHECK(length(fingerprint)=64), account_id TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('success','unknown')), run_id TEXT NOT NULL, created_at INTEGER NOT NULL
) STRICT;
CREATE TABLE task_mail_ledger (
    mail_id TEXT PRIMARY KEY REFERENCES mail_message(id) ON DELETE CASCADE,
    body_revision INTEGER NOT NULL, fingerprint TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('success','unknown','blocked'))
) STRICT;
-- +down
DROP TABLE task_mail_ledger;
DROP TABLE task_receipt;
DROP TABLE task_run_mail;
DROP TABLE task_run;
DROP TABLE todo_proposal;
DROP TABLE todo_source;
DROP TABLE todo_item;
DROP TABLE task_baseline;
DROP TABLE task_preferences;
DROP TRIGGER task_body_revision;
DROP TRIGGER task_observe_mail;
DROP TABLE task_mail_seen;
ALTER TABLE mail_message DROP COLUMN ai_body_revision;
ALTER TABLE mailbox DROP COLUMN ai_head_known;
ALTER TABLE mailbox DROP COLUMN ai_head_uid;
