package storage

import (
	"database/sql"
	"path/filepath"
	"testing"
)

func TestRemoteMailboxHistoryCursorIdempotentMigration(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "mail.db")
	db, err := sql.Open("sqlite", buildSQLiteDSN(dbPath))
	if err != nil {
		t.Fatal(err)
	}
	defer CheckpointAndClose(db)

	// 模拟 v2 老库：remote_mailboxes 尚未包含 oldest_uid / history_exhausted 列。
	legacyDDL := []string{
		`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);`,
		`CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL);`,
		`CREATE TABLE remote_mailboxes (
			id TEXT PRIMARY KEY,
			account_id TEXT NOT NULL,
			remote_name TEXT NOT NULL,
			local_folder TEXT NOT NULL,
			uid_validity INTEGER NOT NULL DEFAULT 0,
			last_uid INTEGER NOT NULL DEFAULT 0,
			highest_modseq INTEGER NOT NULL DEFAULT 0,
			total_count INTEGER NOT NULL DEFAULT 0,
			unread_count INTEGER NOT NULL DEFAULT 0,
			updated_at INTEGER NOT NULL
		);`,
		`CREATE TABLE messages (
			id TEXT PRIMARY KEY,
			account_id TEXT NOT NULL,
			remote_mailbox_id TEXT NOT NULL DEFAULT '',
			remote_uid INTEGER NOT NULL DEFAULT 0
		);`,
		`INSERT INTO schema_migrations(version, applied_at) VALUES (1, 1), (2, 2);`,
		`INSERT INTO accounts(id, name) VALUES ('acc-1', 'Work');`,
		`INSERT INTO remote_mailboxes(id, account_id, remote_name, local_folder, uid_validity, last_uid, total_count, updated_at)
		 VALUES ('acc-1:INBOX', 'acc-1', 'INBOX', 'inbox', 7, 500, 320, 100);`,
		`INSERT INTO messages(id, account_id, remote_mailbox_id, remote_uid) VALUES
		 ('m1', 'acc-1', 'acc-1:INBOX', 450),
		 ('m2', 'acc-1', 'acc-1:INBOX', 351),
		 ('m3', 'acc-1', 'acc-1:INBOX', 500);`,
	}
	for _, stmt := range legacyDDL {
		if _, err := db.Exec(stmt); err != nil {
			t.Fatalf("初始化老库失败: %v", err)
		}
	}

	if err := RunMigrations(db); err != nil {
		t.Fatalf("首次迁移老库失败: %v", err)
	}
	// 二次显式调用幂等迁移，不应报错。
	if err := migrateRemoteMailboxHistoryCursor(db); err != nil {
		t.Fatalf("重复执行迁移失败: %v", err)
	}

	var oldest, exhausted int
	if err := db.QueryRow(`SELECT oldest_uid, history_exhausted FROM remote_mailboxes WHERE id='acc-1:INBOX'`).Scan(&oldest, &exhausted); err != nil {
		t.Fatalf("读取新列失败: %v", err)
	}
	if oldest != 351 || exhausted != 0 {
		t.Fatalf("期望懒回填 oldest_uid=351, history_exhausted=0，实际 oldest=%d exhausted=%d", oldest, exhausted)
	}
}
