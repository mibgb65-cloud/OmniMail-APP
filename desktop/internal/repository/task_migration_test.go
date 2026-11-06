package repository

import (
	"database/sql"
	"fmt"
	"path/filepath"
	"testing"
	"testing/fstest"

	"omnimail/desktop/internal/domain"
)

func TestTaskMigrationBacksUpV5AndDoesNotEnableBackgroundSharing(t *testing.T) {
	dir := t.TempDir()
	db, err := sql.Open("sqlite", databaseURI(filepath.Join(dir, "omnimail.db")))
	if err != nil {
		t.Fatal(err)
	}
	old := fstest.MapFS{}
	for _, name := range []string{"0001_accounts.sql", "0002_mail.sql", "0003_rich_mail.sql", "0004_large_mail.sql", "0005_zero_uidvalidity.sql"} {
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
	account := createTestAccount(t, legacy, accountInput("custom"))
	box, err := legacy.PrepareMailbox(t.Context(), account.ID, domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, 7)
	if err != nil {
		t.Fatal(err)
	}
	if err := legacy.SaveMailBatch(t.Context(), account.ID, box.ID, 7, 1, 1, []domain.RemoteMessage{{UID: 1, Subject: "legacy", Read: true, Starred: true}}, nil); err != nil {
		t.Fatal(err)
	}
	list, err := legacy.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(list) != 1 {
		t.Fatal(err)
	}
	if err := legacy.SaveMailBody(t.Context(), list[0].ID, domain.DecodedMail{Text: "legacy body"}); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	s, err := Open(t.Context(), dir)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	mail, err := s.ReadTaskMail(t.Context(), list[0].ID)
	if err != nil || mail.Body != "legacy body" || !mail.Read || !mail.Starred {
		t.Fatal("迁移破坏旧数据", err)
	}
	p, err := s.ReadTaskPreferences(t.Context())
	if err != nil || p.Enabled || p.Consent || len(p.Accounts) != 0 {
		t.Fatal("迁移擅自开启外发", err)
	}
	migrations, err := loadMigrations(migrationFiles)
	if err != nil {
		t.Fatal(err)
	}
	backups, err := filepath.Glob(filepath.Join(dir, "backups", fmt.Sprintf("pre-migration-v%04d-*.db", len(migrations))))
	if err != nil || len(backups) != 1 {
		t.Fatal("缺少迁移前备份")
	}
	backup, err := sql.Open("sqlite", databaseURI(backups[0]))
	if err != nil {
		t.Fatal(err)
	}
	defer backup.Close()
	var version int
	if backup.QueryRow("SELECT max(version) FROM schema_migration").Scan(&version) != nil || version != 5 {
		t.Fatal("备份不是迁移前版本")
	}
}
