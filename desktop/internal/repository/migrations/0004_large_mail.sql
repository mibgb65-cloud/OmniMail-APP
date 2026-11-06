-- +up
-- 只替换受限列，不重建/删除父邮件表，避免触发附件外键的级联删除。
ALTER TABLE mail_message RENAME COLUMN body_html TO body_html_legacy;
ALTER TABLE mail_message ADD COLUMN body_html TEXT NOT NULL DEFAULT ''
    CHECK(COALESCE(length(CAST(body_text AS BLOB)),0) + length(CAST(body_html AS BLOB)) <= 8388608);
UPDATE mail_message SET body_html=body_html_legacy;
ALTER TABLE mail_message DROP COLUMN body_html_legacy;
ALTER TABLE mail_message ADD COLUMN body_error_code TEXT NOT NULL DEFAULT ''
    CHECK(body_error_code IN ('','MESSAGE_RAW_TOO_LARGE','ATTACHMENT_TOO_LARGE','MESSAGE_TEXT_TOO_LARGE','MESSAGE_PARTS_TOO_MANY'));
CREATE INDEX idx_message_body_error ON mail_message(account_id) WHERE body_error_code<>'';

ALTER TABLE mail_attachment RENAME COLUMN size_bytes TO size_bytes_legacy;
ALTER TABLE mail_attachment ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0
    CHECK(size_bytes BETWEEN 0 AND 52428800);
UPDATE mail_attachment SET size_bytes=size_bytes_legacy;
ALTER TABLE mail_attachment DROP COLUMN size_bytes_legacy;

-- +down
-- 不支持自动降级：旧版约束无法容纳新正文/附件。请恢复升级前备份，不截断正文或删除附件。
