package storage

import (
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

func buildSQLiteDSN(dbPath string) string {
	q := url.Values{}
	q.Add("_pragma", "journal_mode(WAL)")
	q.Add("_pragma", "synchronous(NORMAL)")
	q.Add("_pragma", "foreign_keys(ON)")
	q.Add("_pragma", "busy_timeout(5000)")
	q.Add("_pragma", "temp_store(MEMORY)")
	return dbPath + "?" + q.Encode()
}

// OpenProfileDB 打开当前本地空间的 SQLite 数据库并执行全量表结构迁移。
func OpenProfileDB(profileDir string) (*sql.DB, error) {
	if err := os.MkdirAll(profileDir, 0o700); err != nil {
		return nil, err
	}
	dbPath := filepath.Join(profileDir, "mail.db")
	db, err := sql.Open("sqlite", buildSQLiteDSN(dbPath))
	if err != nil {
		return nil, fmt.Errorf("打开数据库失败: %w", err)
	}
	db.SetMaxOpenConns(4)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(30 * time.Minute)

	pragmas := []string{
		"PRAGMA journal_mode = WAL;",
		"PRAGMA synchronous = NORMAL;",
		"PRAGMA foreign_keys = ON;",
		"PRAGMA busy_timeout = 5000;",
		"PRAGMA temp_store = MEMORY;",
	}
	for _, stmt := range pragmas {
		if _, err := db.Exec(stmt); err != nil {
			_ = db.Close()
			return nil, fmt.Errorf("初始化 SQLite PRAGMA 失败: %w", err)
		}
	}

	if err := RunMigrations(db); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}

// CheckpointAndClose 执行 WAL 截断落盘并安全关闭数据库连接，避免空间切换或迁移残留锁。
func CheckpointAndClose(db *sql.DB) error {
	if db == nil {
		return nil
	}
	_, _ = db.Exec("PRAGMA wal_checkpoint(TRUNCATE);")
	return db.Close()
}

func RunMigrations(db *sql.DB) error {
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version INTEGER PRIMARY KEY,
		applied_at INTEGER NOT NULL
	);`); err != nil {
		return err
	}
	var current int
	_ = db.QueryRow(`SELECT COALESCE(MAX(version), 0) FROM schema_migrations`).Scan(&current)
	if current < 1 {
		tx, err := db.Begin()
		if err != nil {
			return err
		}
		for _, ddl := range allSchemaStatements() {
			if _, err := tx.Exec(ddl); err != nil {
				_ = tx.Rollback()
				return fmt.Errorf("执行 Schema 迁移失败: %w", err)
			}
		}
		if _, err := tx.Exec(`INSERT INTO schema_migrations(version, applied_at) VALUES (1, ?)`, time.Now().UnixMilli()); err != nil {
			_ = tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
		seedDefaultLabels(db)
	}
	if current < 2 {
		return migrateContactAliases(db)
	}
	return nil
}
