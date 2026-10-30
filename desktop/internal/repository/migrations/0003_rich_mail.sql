-- +up
ALTER TABLE mail_message ADD COLUMN body_html TEXT NOT NULL DEFAULT '' CHECK(length(body_html) <= 1048576);
ALTER TABLE mail_message ADD COLUMN body_version INTEGER NOT NULL DEFAULT 0 CHECK(body_version IN (0,1));
ALTER TABLE mail_attachment ADD COLUMN content_id TEXT NOT NULL DEFAULT '' CHECK(length(content_id) <= 998);

-- +down
ALTER TABLE mail_attachment DROP COLUMN content_id;
ALTER TABLE mail_message DROP COLUMN body_version;
ALTER TABLE mail_message DROP COLUMN body_html;
