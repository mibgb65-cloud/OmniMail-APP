-- +up
CREATE TABLE mailbox (
    id TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    remote_name TEXT NOT NULL CHECK(length(remote_name) BETWEEN 1 AND 1024),
    kind TEXT NOT NULL CHECK(kind IN ('inbox','sent','drafts','deleted','archive','other')),
    uid_validity INTEGER NOT NULL CHECK(uid_validity BETWEEN 1 AND 4294967295),
    last_uid INTEGER NOT NULL DEFAULT 0 CHECK(last_uid BETWEEN 0 AND 4294967295),
    scan_uid INTEGER NOT NULL DEFAULT 0 CHECK(scan_uid BETWEEN 0 AND 4294967295),
    UNIQUE(account_id, remote_name),
    UNIQUE(id, account_id)
) STRICT;
CREATE TABLE mail_message (
    id TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    mailbox_id TEXT NOT NULL,
    uid_validity INTEGER NOT NULL CHECK(uid_validity BETWEEN 1 AND 4294967295),
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
    FOREIGN KEY(mailbox_id, account_id) REFERENCES mailbox(id, account_id) ON DELETE CASCADE,
    UNIQUE(mailbox_id, uid_validity, uid)
) STRICT;
CREATE INDEX idx_message_account_time ON mail_message(account_id, received_at DESC, id DESC);
CREATE INDEX idx_message_mailbox ON mail_message(mailbox_id, uid_validity, uid);
CREATE TABLE mail_attachment (
    id TEXT PRIMARY KEY NOT NULL,
    mail_id TEXT NOT NULL REFERENCES mail_message(id) ON DELETE CASCADE,
    filename TEXT NOT NULL CHECK(length(filename) BETWEEN 1 AND 256),
    mime TEXT NOT NULL CHECK(length(mime) <= 128),
    size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 0 AND 26214400),
    content_hash TEXT NOT NULL CHECK(length(content_hash) = 64)
) STRICT;
CREATE INDEX idx_attachment_mail ON mail_attachment(mail_id);
CREATE INDEX idx_attachment_content ON mail_attachment(content_hash);

-- +down
DROP TABLE mail_attachment;
DROP TABLE mail_message;
DROP TABLE mailbox;
