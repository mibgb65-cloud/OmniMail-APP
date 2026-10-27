package repository

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
)

func openTestStore(t *testing.T) *Store {
	t.Helper()
	store, err := Open(t.Context(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := store.Close(); err != nil {
			t.Error(err)
		}
	})
	return store
}

func TestOpenAndReopen(t *testing.T) {
	directory := filepath.Join(t.TempDir(), "数据库 空格#&")
	for range 2 {
		store, err := Open(t.Context(), directory)
		if err != nil {
			t.Fatal(err)
		}
		var foreignKeys, version int
		if err := store.db.QueryRow("PRAGMA foreign_keys").Scan(&foreignKeys); err != nil {
			t.Fatal(err)
		}
		if err := store.db.QueryRow("SELECT max(version) FROM schema_migration").Scan(&version); err != nil {
			t.Fatal(err)
		}
		if foreignKeys != 1 || version != 1 {
			t.Fatalf("外键或迁移版本异常：%d / %d", foreignKeys, version)
		}
		if _, err := store.db.Exec("CREATE VIRTUAL TABLE temp.search_test USING fts5(body)"); err != nil {
			t.Fatalf("驱动缺少 FTS5：%v", err)
		}
		if err := store.Close(); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := os.Stat(filepath.Join(directory, "backups")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("无升级时不应生成备份：%v", err)
	}
}

func TestOpenRejectsInvalidAndCanceled(t *testing.T) {
	for _, path := range []string{"", ".", "relative", filepath.VolumeName(t.TempDir()) + `\`, "C:\\bad\x00path"} {
		if _, err := Open(t.Context(), path); err == nil {
			t.Fatal("接受了非法路径")
		}
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	path := filepath.Join(t.TempDir(), "not-created")
	if _, err := Open(ctx, path); !errors.Is(err, context.Canceled) {
		t.Fatalf("取消错误丢失：%v", err)
	}
	if _, err := os.Stat(path); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("取消后仍创建了数据库目录")
	}
}

func TestMigrationRefusesUnknownAndTamperedHistory(t *testing.T) {
	store := openTestStore(t)
	if _, err := store.db.Exec("UPDATE schema_migration SET checksum = ?", strings.Repeat("0", 64)); err != nil {
		t.Fatal(err)
	}
	if err := migrate(t.Context(), store.db, t.TempDir(), migrationFiles); !errors.Is(err, ErrSchemaVersion) {
		t.Fatalf("未拒绝校验异常：%v", err)
	}
	if _, err := store.db.Exec("PRAGMA application_id=123"); err != nil {
		t.Fatal(err)
	}
	if err := initialize(t.Context(), store.db, t.TempDir()); !errors.Is(err, ErrDatabaseIdentity) {
		t.Fatalf("未拒绝其他应用数据库：%v", err)
	}
}

func TestMigrationUpgradeBackupAndRollback(t *testing.T) {
	store := openTestStore(t)
	createTestAccount(t, store, accountInput("custom"))
	initial, err := migrationFiles.ReadFile("migrations/0001_accounts.sql")
	if err != nil {
		t.Fatal(err)
	}
	source := fstest.MapFS{
		"migrations/0001_accounts.sql": {Data: initial},
		"migrations/0002_test.sql": {Data: []byte(
			"-- +up\nCREATE TABLE upgrade_probe(id INTEGER PRIMARY KEY);\n-- +down\nDROP TABLE upgrade_probe;")},
	}
	directory := t.TempDir()
	if err := migrate(t.Context(), store.db, directory, source); err != nil {
		t.Fatal(err)
	}
	backups, err := filepath.Glob(filepath.Join(directory, "backups", "*.db"))
	if err != nil || len(backups) != 1 {
		t.Fatalf("未创建唯一备份：%v / %d", err, len(backups))
	}
	backup, err := sql.Open("sqlite", databaseURI(backups[0]))
	if err != nil {
		t.Fatal(err)
	}
	var version int
	queryError := backup.QueryRow("SELECT max(version) FROM schema_migration").Scan(&version)
	var accounts int
	accountError := backup.QueryRow("SELECT count(*) FROM account").Scan(&accounts)
	if err := errors.Join(queryError, accountError, backup.Close()); err != nil || version != 1 || accounts != 1 {
		t.Fatalf("备份不是升级前的有效版本：%v / %d", err, version)
	}
	source["migrations/0003_broken.sql"] = &fstest.MapFile{Data: []byte(
		"-- +up\nCREATE TABLE must_rollback(id INTEGER); INVALID SQL;\n-- +down\nDROP TABLE must_rollback;")}
	if err := migrate(t.Context(), store.db, directory, source); err == nil {
		t.Fatal("错误 SQL 未导致迁移失败")
	}
	var tables int
	if err := store.db.QueryRow("SELECT count(*) FROM sqlite_schema WHERE name='must_rollback'").Scan(&tables); err != nil {
		t.Fatal(err)
	}
	if tables != 0 {
		t.Fatal("失败迁移留下了部分结构")
	}
	if err := store.db.QueryRow("SELECT max(version) FROM schema_migration").Scan(&version); err != nil || version != 2 {
		t.Fatalf("失败迁移改变了版本：%v / %d", err, version)
	}
	if err := migrate(t.Context(), store.db, directory, migrationFiles); !errors.Is(err, ErrSchemaVersion) {
		t.Fatalf("未拒绝较新数据库：%v", err)
	}
}

func TestStorageErrorDoesNotRevealCause(t *testing.T) {
	cause := errors.New("sensitive@example.invalid secret")
	err := storageError("写入数据库", cause)
	if strings.Contains(err.Error(), "sensitive") || !errors.Is(err, cause) {
		t.Fatal("存储错误泄漏内容或丢失错误链")
	}
}
