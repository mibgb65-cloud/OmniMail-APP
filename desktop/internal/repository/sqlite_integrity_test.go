package repository

import (
	"database/sql"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"omnimail/desktop/internal/domain"
)

func TestOwnedDatabaseMissingHistoryIsRefused(t *testing.T) {
	store := openTestStore(t)
	if _, err := store.db.Exec("DROP TABLE schema_migration"); err != nil {
		t.Fatal(err)
	}
	if err := initialize(t.Context(), store.db, t.TempDir()); !errors.Is(err, ErrSchemaVersion) {
		t.Fatalf("丢失迁移历史应明确拒绝重建：%v", err)
	}
}

func TestMigrationFilesAreValidated(t *testing.T) {
	for _, source := range []fstest.MapFS{
		{},
		{"migrations/0002_skip.sql": {Data: []byte("-- +up\nSELECT 1;\n-- +down\n")}},
		{"migrations/0001_empty.sql": {Data: []byte("-- +up\n\n-- +down\n")}},
		{"migrations/0001_invalid.sql": {Data: []byte("SELECT 1;")}},
	} {
		if _, err := loadMigrations(source); err == nil {
			t.Fatal("非法迁移定义未被拒绝")
		}
	}
	content, err := migrationFiles.ReadFile("migrations/0001_accounts.sql")
	if err != nil {
		t.Fatal(err)
	}
	original, err := loadMigrations(migrationFiles)
	if err != nil {
		t.Fatal(err)
	}
	windows := fstest.MapFS{"migrations/0001_accounts.sql": {
		Data: []byte(strings.ReplaceAll(string(content), "\n", "\r\n")),
	}}
	normalized, err := loadMigrations(windows)
	if err != nil || original[0].checksum != normalized[0].checksum {
		t.Fatalf("迁移校验受平台换行影响：%v", err)
	}
}

func TestForeignKeysSurviveConnectionRecreation(t *testing.T) {
	store := openTestStore(t)
	account := createTestAccount(t, store, accountInput("custom"))
	store.db.SetMaxIdleConns(0)
	if _, err := store.db.Exec("UPDATE account_endpoint SET account_id='missing' WHERE account_id=?", account.ID); err == nil {
		t.Fatal("重建连接后外键未启用")
	}
}

func TestUnmanagedDatabaseIsNotMigrated(t *testing.T) {
	directory := t.TempDir()
	db, err := sql.Open("sqlite", databaseURI(filepath.Join(directory, "omnimail.db")))
	if err != nil {
		t.Fatal(err)
	}
	_, setupError := db.Exec("CREATE TABLE foreign_data(value TEXT); INSERT INTO foreign_data VALUES ('keep')")
	if err := errors.Join(setupError, db.Close()); err != nil {
		t.Fatal(err)
	}
	if _, err := Open(t.Context(), directory); !errors.Is(err, ErrDatabaseIdentity) {
		t.Fatalf("未拒绝未知数据库：%v", err)
	}
}

func TestProviderDefaultsDoNotRewriteAccounts(t *testing.T) {
	store := openTestStore(t)
	preset, found := domain.FindProviderPreset("qq")
	if !found {
		t.Fatal("预设缺失")
	}
	input := accountInput(preset.Code)
	for i, endpoint := range preset.Endpoints {
		input.Endpoints[i].Host = endpoint.Host
		input.Endpoints[i].Port = endpoint.Port
		input.Endpoints[i].TLSMode = endpoint.TLSMode
	}
	account := createTestAccount(t, store, input)
	preset.Endpoints[0].Host = "new-default.example.invalid"
	got, err := store.GetAccount(t.Context(), account.ID)
	if err != nil || got.Endpoints[0].Host != "imap.qq.com" {
		t.Fatalf("预设更改影响账号快照：%v", err)
	}
}
