package storage

import (
	"database/sql"
	"net/mail"
	"strings"
	"time"
)

func migrateContactAliases(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, stmt := range []string{
		`CREATE TABLE IF NOT EXISTS contact_aliases (
			email TEXT NOT NULL PRIMARY KEY COLLATE NOCASE,
			contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_contact_aliases_owner ON contact_aliases(contact_id)`,
		`CREATE TABLE IF NOT EXISTS contact_duplicate_ignores (group_key TEXT PRIMARY KEY)`,
	} {
		if _, err := tx.Exec(stmt); err != nil {
			return err
		}
	}
	if err := backfillContactAliasNotes(tx); err != nil {
		return err
	}
	if _, err := tx.Exec(`INSERT INTO schema_migrations(version, applied_at) VALUES (2, ?)`, time.Now().UnixMilli()); err != nil {
		return err
	}
	return tx.Commit()
}

func backfillContactAliasNotes(tx *sql.Tx) error {
	// 旧版将备用地址附在备注末尾。只迁移可完整解析的列表，不改备注或覆盖其他联系人。
	rows, err := tx.Query(`SELECT id, note FROM contacts WHERE note LIKE '%备用邮箱: %' ORDER BY id`)
	if err != nil {
		return err
	}
	type alias struct{ id, email string }
	var aliases []alias
	for rows.Next() {
		var id, note string
		if err := rows.Scan(&id, &note); err != nil {
			rows.Close()
			return err
		}
		const marker = "备用邮箱: "
		start := strings.LastIndex(note, " | "+marker)
		if start >= 0 {
			start += len(" | ")
		} else if strings.HasPrefix(note, marker) {
			start = 0
		} else {
			continue
		}
		var exact []alias
		for _, value := range strings.Split(note[start+len(marker):], ", ") {
			email := strings.ToLower(strings.TrimSpace(value))
			parsed, err := mail.ParseAddress(email)
			if err != nil || parsed.Address != email || parsed.Name != "" || len(email) > 254 {
				exact = nil
				break
			}
			exact = append(exact, alias{id, email})
		}
		aliases = append(aliases, exact...)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	owners := make(map[string]string)
	for _, value := range aliases {
		if owner, ok := owners[value.email]; ok && owner != value.id {
			owners[value.email] = ""
		} else if !ok {
			owners[value.email] = value.id
		}
	}
	for email, owner := range owners {
		if owner == "" {
			continue
		}
		if _, err := tx.Exec(`INSERT OR IGNORE INTO contact_aliases(email, contact_id)
			SELECT ?, ? WHERE NOT EXISTS(SELECT 1 FROM contacts WHERE LOWER(email)=?)`,
			email, owner, email); err != nil {
			return err
		}
	}
	return nil
}
