package repository

import (
	"database/sql"
	"path/filepath"
	"testing"
	"testing/fstest"
)

func TestRichMigrationPreservesLegacyTextAndCreatesBackup(t *testing.T) {
	dir := t.TempDir()
	db, err := sql.Open("sqlite", databaseURI(filepath.Join(dir, "omnimail.db")))
	if err != nil {
		t.Fatal(err)
	}
	old := fstest.MapFS{}
	for _, name := range []string{"0001_accounts.sql", "0002_mail.sql"} {
		data, err := migrationFiles.ReadFile("migrations/" + name)
		if err != nil {
			t.Fatal(err)
		}
		old["migrations/"+name] = &fstest.MapFile{Data: data}
	}
	if err := migrate(t.Context(), db, dir, old); err != nil {
		t.Fatal(err)
	}
	legacy := &Store{db: db, dataDir: dir, staged: map[string]int{}}
	account, _ := seedMailbox(t, legacy)
	list, err := legacy.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec("UPDATE mail_message SET body_text='历史正文' WHERE id=?", list[0].ID); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	current, err := Open(t.Context(), dir)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := current.Close(); err != nil {
			t.Error(err)
		}
	}()
	got, err := current.ReadMail(t.Context(), list[0].ID)
	if err != nil || !got.Cached || got.Body != "历史正文" || got.BodyVersion != 0 || got.RawHTML != "" {
		t.Fatal("升级丢失旧缓存或错误标记为完整正文")
	}
	backups, err := filepath.Glob(filepath.Join(dir, "backups", "pre-migration-v0003-*.db"))
	if err != nil || len(backups) != 1 {
		t.Fatal("未生成迁移前备份")
	}
}
