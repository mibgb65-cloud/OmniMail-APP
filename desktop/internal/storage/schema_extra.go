package storage

import "database/sql"

var extraSchemaStatements = []string{
	`CREATE TABLE IF NOT EXISTS imap_op_queue (
		id             INTEGER PRIMARY KEY AUTOINCREMENT,
		account_id     TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
		message_id     TEXT NOT NULL DEFAULT '',
		remote_mailbox TEXT NOT NULL DEFAULT '',
		remote_uid     INTEGER NOT NULL DEFAULT 0,
		op_type        TEXT NOT NULL,
		target_folder  TEXT NOT NULL DEFAULT '',
		retry_count    INTEGER NOT NULL DEFAULT 0,
		last_error     TEXT NOT NULL DEFAULT '',
		created_at     INTEGER NOT NULL
	);`,
	`CREATE INDEX IF NOT EXISTS idx_imap_op_acc ON imap_op_queue(account_id, id ASC);`,

	`CREATE TABLE IF NOT EXISTS drafts (
		id               TEXT PRIMARY KEY,
		account_id       TEXT NOT NULL,
		mode             TEXT NOT NULL DEFAULT 'new',
		reply_to_mail_id TEXT NOT NULL DEFAULT '',
		locked_account   INTEGER NOT NULL DEFAULT 0,
		to_json          TEXT NOT NULL DEFAULT '[]',
		cc_json          TEXT NOT NULL DEFAULT '[]',
		bcc_json         TEXT NOT NULL DEFAULT '[]',
		subject          TEXT NOT NULL DEFAULT '',
		body_text        TEXT NOT NULL DEFAULT '',
		body_html        TEXT NOT NULL DEFAULT '',
		attachments_json TEXT NOT NULL DEFAULT '[]',
		scheduled_at     INTEGER NOT NULL DEFAULT 0,
		updated_at       INTEGER NOT NULL
	);`,
	draftInlineImagesDDL,
	draftInlineImagesIdxDDL,

	`CREATE TABLE IF NOT EXISTS outbox_jobs (
		id              TEXT PRIMARY KEY,
		account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
		draft_id        TEXT NOT NULL DEFAULT '',
		message_id      TEXT NOT NULL DEFAULT '',
		rfc_message_id  TEXT NOT NULL DEFAULT '',
		envelope_json   TEXT NOT NULL DEFAULT '{}',
		raw_mime_sha256 TEXT NOT NULL,
		state           TEXT NOT NULL,
		not_before_at   INTEGER NOT NULL,
		retry_count     INTEGER NOT NULL DEFAULT 0,
		max_retries     INTEGER NOT NULL DEFAULT 5,
		last_error      TEXT NOT NULL DEFAULT '',
		created_at      INTEGER NOT NULL,
		updated_at      INTEGER NOT NULL
	);`,
	`CREATE INDEX IF NOT EXISTS idx_outbox_due ON outbox_jobs(state, not_before_at);`,

	`CREATE TABLE IF NOT EXISTS contacts (
		id                TEXT PRIMARY KEY,
		name              TEXT NOT NULL,
		email             TEXT NOT NULL UNIQUE,
		company           TEXT NOT NULL DEFAULT '',
		title             TEXT NOT NULL DEFAULT '',
		phone             TEXT NOT NULL DEFAULT '',
		note              TEXT NOT NULL DEFAULT '',
		source_account_id TEXT NOT NULL DEFAULT '',
		groups_json       TEXT NOT NULL DEFAULT '[]',
		is_vip            INTEGER NOT NULL DEFAULT 0,
		is_blocked        INTEGER NOT NULL DEFAULT 0,
		user_edited       INTEGER NOT NULL DEFAULT 0,
		mail_count        INTEGER NOT NULL DEFAULT 0,
		last_contact_at   INTEGER NOT NULL DEFAULT 0,
		updated_at        INTEGER NOT NULL
	);`,

	`CREATE TABLE IF NOT EXISTS blacklist_entries (
		id            TEXT PRIMARY KEY,
		target        TEXT NOT NULL UNIQUE,
		kind          TEXT NOT NULL,
		reason        TEXT NOT NULL DEFAULT '',
		blocked_count INTEGER NOT NULL DEFAULT 0,
		added_at      INTEGER NOT NULL
	);`,

	`CREATE TABLE IF NOT EXISTS inbox_rules (
		id               TEXT PRIMARY KEY,
		name             TEXT NOT NULL,
		enabled          INTEGER NOT NULL DEFAULT 1,
		priority         INTEGER NOT NULL DEFAULT 100,
		match_mode       TEXT NOT NULL DEFAULT 'AND',
		account_scope    TEXT NOT NULL DEFAULT 'all',
		conditions_json  TEXT NOT NULL,
		actions_json     TEXT NOT NULL,
		stop_matching    INTEGER NOT NULL DEFAULT 0,
		hits_last_7_days INTEGER NOT NULL DEFAULT 0,
		updated_at       INTEGER NOT NULL
	);`,

	`CREATE TABLE IF NOT EXISTS rule_hit_logs (
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		rule_id    TEXT NOT NULL REFERENCES inbox_rules(id) ON DELETE CASCADE,
		message_id TEXT NOT NULL,
		hit_at     INTEGER NOT NULL
	);`,
	`CREATE INDEX IF NOT EXISTS idx_rule_hits_time ON rule_hit_logs(rule_id, hit_at);`,

	`CREATE TABLE IF NOT EXISTS auto_reply_sent_log (
		account_id      TEXT NOT NULL,
		sender_email    TEXT NOT NULL,
		last_replied_at INTEGER NOT NULL,
		PRIMARY KEY (account_id, sender_email)
	);`,

	`CREATE TABLE IF NOT EXISTS calendar_events (
		uid         TEXT NOT NULL,
		account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
		message_id  TEXT NOT NULL DEFAULT '',
		title       TEXT NOT NULL DEFAULT '',
		start_at    INTEGER NOT NULL,
		end_at      INTEGER NOT NULL,
		rsvp_status TEXT NOT NULL DEFAULT 'pending',
		PRIMARY KEY (uid, account_id)
	);`,

	`CREATE TABLE IF NOT EXISTS ai_insights (
		message_id      TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
		model_name      TEXT NOT NULL,
		insight_json    TEXT NOT NULL,
		chat_turns_json TEXT NOT NULL DEFAULT '[]',
		updated_at      INTEGER NOT NULL
	);`,

	`CREATE TABLE IF NOT EXISTS sync_logs (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		account_id  TEXT NOT NULL DEFAULT '',
		protocol    TEXT NOT NULL DEFAULT 'IMAP',
		level       TEXT NOT NULL,
		stage       TEXT NOT NULL,
		duration_ms INTEGER NOT NULL DEFAULT 0,
		message     TEXT NOT NULL,
		detail      TEXT NOT NULL DEFAULT '',
		created_at  INTEGER NOT NULL
	);`,
	`CREATE INDEX IF NOT EXISTS idx_sync_logs_time ON sync_logs(created_at DESC);`,
}

func allSchemaStatements() []string {
	out := make([]string, 0, len(coreSchemaStatements)+len(extraSchemaStatements))
	out = append(out, coreSchemaStatements...)
	out = append(out, extraSchemaStatements...)
	return out
}

func seedDefaultLabels(db *sql.DB) {
	var count int
	_ = db.QueryRow(`SELECT COUNT(1) FROM labels`).Scan(&count)
	if count > 0 {
		return
	}
	defaults := []struct{ id, name, color string }{
		{"lbl-work", "核心工作", "#2563EB"},
		{"lbl-finance", "账单发票", "#059669"},
		{"lbl-review", "待评审", "#D97706"},
		{"lbl-opensource", "开源社区", "#7C3AED"},
	}
	for _, d := range defaults {
		_, _ = db.Exec(`INSERT OR IGNORE INTO labels(id, name, color) VALUES (?, ?, ?)`, d.id, d.name, d.color)
	}
}
