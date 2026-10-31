package repository

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"embed"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

type migration struct {
	version  int
	checksum string
	up       string
}

func loadMigrations(source fs.FS) ([]migration, error) {
	entries, err := fs.ReadDir(source, "migrations")
	if err != nil {
		return nil, storageError("读取内置迁移", err)
	}
	var result []migration
	for _, entry := range entries {
		name := entry.Name()
		version, err := strconv.Atoi(strings.SplitN(name, "_", 2)[0])
		if err != nil || entry.IsDir() || !strings.HasSuffix(name, ".sql") || version != len(result)+1 {
			return nil, ErrSchemaVersion
		}
		content, err := fs.ReadFile(source, "migrations/"+name)
		if err != nil {
			return nil, storageError("读取迁移内容", err)
		}
		// Git 换行设置不应使相同迁移在 Windows/macOS 上产生不同校验和。
		normalized := strings.ReplaceAll(string(content), "\r\n", "\n")
		parts := strings.Split(normalized, "-- +down")
		if len(parts) != 2 || !strings.HasPrefix(parts[0], "-- +up\n") {
			return nil, schemaError(version)
		}
		up := strings.TrimSpace(strings.TrimPrefix(parts[0], "-- +up\n"))
		if up == "" {
			return nil, schemaError(version)
		}
		sum := sha256.Sum256([]byte(normalized))
		result = append(result, migration{version, hex.EncodeToString(sum[:]), up})
	}
	if len(result) == 0 {
		return nil, ErrSchemaVersion
	}
	return result, nil
}

func appliedVersion(ctx context.Context, db interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}, migrations []migration) (version int, err error) {
	rows, err := db.QueryContext(ctx, "SELECT version, checksum FROM schema_migration ORDER BY version")
	if err != nil {
		return 0, storageError("读取迁移历史", err)
	}
	defer func() { err = joinClose(err, rows.Close()) }()
	for rows.Next() {
		var current int
		var checksum string
		if err := rows.Scan(&current, &checksum); err != nil {
			return 0, storageError("解析迁移历史", err)
		}
		if current != version+1 || current > len(migrations) || checksum != migrations[current-1].checksum {
			return 0, schemaError(current)
		}
		version = current
	}
	return version, storageError("读取迁移历史", rows.Err())
}

func migrate(ctx context.Context, db *sql.DB, dataDir string, source fs.FS) (err error) {
	migrations, err := loadMigrations(source)
	if err != nil {
		return err
	}
	var exists int
	if err := db.QueryRowContext(ctx,
		"SELECT count(*) FROM sqlite_schema WHERE name='schema_migration' AND type='table'").Scan(&exists); err != nil {
		return storageError("检查迁移历史", err)
	}
	if exists != 0 {
		version, err := appliedVersion(ctx, db, migrations)
		if err != nil || version == len(migrations) {
			return err
		}
		if err := backupBeforeMigration(ctx, db, dataDir, len(migrations)); err != nil {
			return err
		}
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return storageError("开始迁移事务", err)
	}
	defer rollback(tx, &err)
	if _, err := tx.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migration (
		version INTEGER PRIMARY KEY CHECK(version > 0),
		applied_at INTEGER NOT NULL CHECK(applied_at > 0),
		checksum TEXT NOT NULL CHECK(length(checksum) = 64)
	) STRICT`); err != nil {
		return storageError("初始化迁移历史", err)
	}
	// BEGIN IMMEDIATE 后重新读取版本，避免两个启动进程重复执行同一迁移。
	version, err := appliedVersion(ctx, tx, migrations)
	if err != nil {
		return err
	}
	for _, migration := range migrations[version:] {
		if _, err := tx.ExecContext(ctx, migration.up); err != nil {
			return storageError("执行数据库迁移", err)
		}
		if _, err := tx.ExecContext(ctx,
			"INSERT INTO schema_migration(version, applied_at, checksum) VALUES (?, ?, ?)",
			migration.version, time.Now().UnixMilli(), migration.checksum); err != nil {
			return storageError("登记数据库迁移", err)
		}
	}
	if _, err := tx.ExecContext(ctx, fmt.Sprintf("PRAGMA application_id=%d", applicationID)); err != nil {
		return storageError("登记数据库身份", err)
	}
	return storageError("提交数据库迁移", tx.Commit())
}

func backupBeforeMigration(ctx context.Context, db *sql.DB, dataDir string, version int) error {
	directory := filepath.Join(dataDir, "backups")
	if err := os.MkdirAll(directory, 0o700); err != nil {
		return storageError("创建迁移备份目录", err)
	}
	path := filepath.Join(directory, fmt.Sprintf("pre-migration-v%04d-%s.db", version, rand.Text()))
	// VACUUM INTO 包含已提交 WAL 数据，不能替换成直接复制正在使用的主库文件。
	_, err := db.ExecContext(ctx, "VACUUM INTO ?", path)
	return storageError("备份迁移前数据库", err)
}

func joinClose(result, closeError error) error {
	if closeError != nil {
		return errors.Join(result, storageError("关闭查询结果", closeError))
	}
	return result
}
