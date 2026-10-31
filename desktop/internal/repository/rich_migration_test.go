package repository

import (
	"database/sql"
	"path/filepath"
	"testing"
	"testing/fstest"

	"omnimail/desktop/internal/domain"
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
	account := createTestAccount(t, legacy, accountInput("custom"))
	cursor, err := legacy.PrepareMailbox(t.Context(), account.ID, domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, 7)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO mail_message
		(id,account_id,mailbox_id,uid_validity,uid,subject,from_addr,to_addrs,received_at,is_read,is_starred,size_bytes)
		VALUES('legacy-mail',?,?,7,1,'legacy','','',1,0,0,1)`, account.ID, cursor.ID); err != nil {
		t.Fatal(err)
	}
	var id string
	// 迁移前夹具只能查询当时的列，不能依赖当前版本 PageMail 的附件元数据。
	if err := db.QueryRow("SELECT id FROM mail_message WHERE account_id=? LIMIT 1", account.ID).Scan(&id); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec("UPDATE mail_message SET body_text='历史正文' WHERE id=?", id); err != nil {
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
	got, err := current.ReadMail(t.Context(), id)
	if err != nil || !got.Cached || got.Body != "历史正文" || got.BodyVersion != 0 || got.RawHTML != "" {
		t.Fatal("升级丢失旧缓存或错误标记为完整正文")
	}
	backups, err := filepath.Glob(filepath.Join(dir, "backups", "pre-migration-v0005-*.db"))
	if err != nil || len(backups) != 1 {
		t.Fatal("未生成迁移前备份")
	}
}
