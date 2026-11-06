-- +up
-- 重建完整引用链后从子到父替换旧表，不能直接删除仍被旧附件表引用的邮件表。
CREATE TABLE mailbox_v5 (
    id TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    remote_name TEXT NOT NULL CHECK(length(remote_name) BETWEEN 1 AND 1024),
    kind TEXT NOT NULL CHECK(kind IN ('inbox','sent','drafts','deleted','archive','other')),
    uid_validity INTEGER NOT NULL CHECK(uid_validity BETWEEN 0 AND 4294967295),
    last_uid INTEGER NOT NULL DEFAULT 0 CHECK(last_uid BETWEEN 0 AND 4294967295),
    scan_uid INTEGER NOT NULL DEFAULT 0 CHECK(scan_uid BETWEEN 0 AND 4294967295),
    UNIQUE(account_id, remote_name),
    UNIQUE(id, account_id)
) STRICT;
INSERT INTO mailbox_v5 SELECT * FROM mailbox;
CREATE TABLE mail_message_v5 (
    id TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    mailbox_id TEXT NOT NULL,
    uid_validity INTEGER NOT NULL CHECK(uid_validity BETWEEN 0 AND 4294967295),
    uid INTEGER NOT NULL CHECK(uid BETWEEN 1 AND 4294967295),
    message_id TEXT,
    subject TEXT NOT NULL CHECK(length(subject) <= 4096),
    from_addr TEXT NOT NULL,
    to_addrs TEXT NOT NULL,
    received_at INTEGER NOT NULL,
    is_read INTEGER NOT NULL CHECK(is_read IN (0,1)),
    is_starred INTEGER NOT NULL CHECK(is_starred IN (0,1)),
    size_bytes INTEGER NOT NULL CHECK(size_bytes >= 0),
    body_text TEXT,
    body_version INTEGER NOT NULL DEFAULT 0 CHECK(body_version IN (0,1)),
    body_html TEXT NOT NULL DEFAULT ''
        CHECK(COALESCE(length(CAST(body_text AS BLOB)),0) + length(CAST(body_html AS BLOB)) <= 8388608),
    body_error_code TEXT NOT NULL DEFAULT ''
        CHECK(body_error_code IN ('','MESSAGE_RAW_TOO_LARGE','ATTACHMENT_TOO_LARGE','MESSAGE_TEXT_TOO_LARGE','MESSAGE_PARTS_TOO_MANY')),
    FOREIGN KEY(mailbox_id, account_id) REFERENCES mailbox_v5(id, account_id) ON DELETE CASCADE,
    UNIQUE(mailbox_id, uid_validity, uid)
) STRICT;
INSERT INTO mail_message_v5
    SELECT id,account_id,mailbox_id,uid_validity,uid,message_id,subject,from_addr,to_addrs,
        received_at,is_read,is_starred,size_bytes,body_text,body_version,body_html,body_error_code FROM mail_message;
CREATE TABLE mail_attachment_v5 (
    id TEXT PRIMARY KEY NOT NULL,
    mail_id TEXT NOT NULL REFERENCES mail_message_v5(id) ON DELETE CASCADE,
    filename TEXT NOT NULL CHECK(length(filename) BETWEEN 1 AND 256),
    mime TEXT NOT NULL CHECK(length(mime) <= 128),
    content_hash TEXT NOT NULL CHECK(length(content_hash) = 64),
    content_id TEXT NOT NULL DEFAULT '' CHECK(length(content_id) <= 998),
    size_bytes INTEGER NOT NULL DEFAULT 0 CHECK(size_bytes BETWEEN 0 AND 52428800)
) STRICT;
INSERT INTO mail_attachment_v5
    SELECT id,mail_id,filename,mime,content_hash,content_id,size_bytes FROM mail_attachment;
DROP TABLE mail_attachment;
DROP TABLE mail_message;
DROP TABLE mailbox;
ALTER TABLE mailbox_v5 RENAME TO mailbox;
ALTER TABLE mail_message_v5 RENAME TO mail_message;
ALTER TABLE mail_attachment_v5 RENAME TO mail_attachment;
CREATE INDEX idx_message_account_time ON mail_message(account_id, received_at DESC, id DESC);
CREATE INDEX idx_message_mailbox ON mail_message(mailbox_id, uid_validity, uid);
CREATE INDEX idx_message_body_error ON mail_message(account_id) WHERE body_error_code<>'';
CREATE INDEX idx_attachment_mail ON mail_attachment(mail_id);
CREATE INDEX idx_attachment_content ON mail_attachment(content_hash);
CREATE TRIGGER trg_mailbox_zero_insert BEFORE INSERT ON mailbox
WHEN NEW.uid_validity=0 AND NOT EXISTS (
    SELECT 1 FROM account a JOIN account_endpoint e ON e.account_id=a.id
    WHERE a.id=NEW.account_id AND a.provider_code='naver' AND e.protocol='imap'
    AND lower(rtrim(e.host,'.'))='imap.naver.com' AND e.port=993 AND e.tls_mode='implicit_tls'
) BEGIN SELECT RAISE(ABORT,'zero validity not allowed'); END;
CREATE TRIGGER trg_mailbox_zero_update BEFORE UPDATE OF uid_validity,account_id ON mailbox
WHEN NEW.uid_validity=0 AND NOT EXISTS (
    SELECT 1 FROM account a JOIN account_endpoint e ON e.account_id=a.id
    WHERE a.id=NEW.account_id AND a.provider_code='naver' AND e.protocol='imap'
    AND lower(rtrim(e.host,'.'))='imap.naver.com' AND e.port=993 AND e.tls_mode='implicit_tls'
) BEGIN SELECT RAISE(ABORT,'zero validity not allowed'); END;
CREATE TRIGGER trg_message_zero_insert BEFORE INSERT ON mail_message
WHEN NEW.uid_validity=0 AND NOT EXISTS (
    SELECT 1 FROM mailbox b JOIN account a ON a.id=b.account_id JOIN account_endpoint e ON e.account_id=a.id
    WHERE b.id=NEW.mailbox_id AND b.account_id=NEW.account_id AND b.uid_validity=0
    AND a.provider_code='naver' AND e.protocol='imap'
    AND lower(rtrim(e.host,'.'))='imap.naver.com' AND e.port=993 AND e.tls_mode='implicit_tls'
) BEGIN SELECT RAISE(ABORT,'zero validity not allowed'); END;
CREATE TRIGGER trg_message_zero_update BEFORE UPDATE OF uid_validity,account_id,mailbox_id ON mail_message
WHEN NEW.uid_validity=0 AND NOT EXISTS (
    SELECT 1 FROM mailbox b JOIN account a ON a.id=b.account_id JOIN account_endpoint e ON e.account_id=a.id
    WHERE b.id=NEW.mailbox_id AND b.account_id=NEW.account_id AND b.uid_validity=0
    AND a.provider_code='naver' AND e.protocol='imap'
    AND lower(rtrim(e.host,'.'))='imap.naver.com' AND e.port=993 AND e.tls_mode='implicit_tls'
) BEGIN SELECT RAISE(ABORT,'zero validity not allowed'); END;

-- +down
-- 旧版不支持零值；只能停机恢复升级前备份，不把真实零值改写为虚构身份。
