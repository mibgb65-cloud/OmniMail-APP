package storage

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
)

func tableHasColumn(tx *sql.Tx, table, column string) (bool, error) {
	rows, err := tx.Query(fmt.Sprintf(`PRAGMA table_info(%s)`, table))
	if err != nil {
		return false, err
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return false, err
		}
		if strings.EqualFold(name, column) {
			return true, nil
		}
	}
	return false, rows.Err()
}

// migrateRemoteMailboxHistoryCursor 幂等为 remote_mailboxes 增加历史回溯游标列并回填老库最小 UID。
func migrateRemoteMailboxHistoryCursor(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	columns := []struct {
		name string
		ddl  string
	}{
		{
			name: "oldest_uid",
			ddl:  `ALTER TABLE remote_mailboxes ADD COLUMN oldest_uid INTEGER NOT NULL DEFAULT 0`,
		},
		{
			name: "history_exhausted",
			ddl:  `ALTER TABLE remote_mailboxes ADD COLUMN history_exhausted INTEGER NOT NULL DEFAULT 0`,
		},
	}
	for _, col := range columns {
		exists, err := tableHasColumn(tx, "remote_mailboxes", col.name)
		if err != nil {
			return err
		}
		if !exists {
			if _, err := tx.Exec(col.ddl); err != nil {
				return fmt.Errorf("迁移 remote_mailboxes.%s 失败: %w", col.name, err)
			}
		}
	}

	// 对已有老库记录懒回填本地已同步的最小远端 UID，避免重复初始化扫描。
	if _, err := tx.Exec(`
		UPDATE remote_mailboxes
		SET oldest_uid = COALESCE((
			SELECT MIN(m.remote_uid) FROM messages m
			WHERE m.remote_mailbox_id = remote_mailboxes.id AND m.remote_uid > 0
		), 0)
		WHERE oldest_uid = 0
	`); err != nil {
		return err
	}

	if _, err := tx.Exec(`INSERT OR REPLACE INTO schema_migrations(version, applied_at) VALUES (3, ?)`, time.Now().UnixMilli()); err != nil {
		return err
	}
	return tx.Commit()
}
