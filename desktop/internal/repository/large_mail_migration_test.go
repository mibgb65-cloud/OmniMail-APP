package repository

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"omnimail/desktop/internal/domain"
)

func TestLargeMailMigrationPreservesReferencesAndExpandsConstraints(t *testing.T) {
	dir := t.TempDir()
	db, err := sql.Open("sqlite", databaseURI(filepath.Join(dir, "omnimail.db")))
	if err != nil {
		t.Fatal(err)
	}
	old := fstest.MapFS{}
	for _, name := range []string{"0001_accounts.sql", "0002_mail.sql", "0003_rich_mail.sql"} {
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
	_, err = db.Exec(`INSERT INTO mail_message
		(id,account_id,mailbox_id,uid_validity,uid,subject,from_addr,to_addrs,received_at,is_read,is_starred,size_bytes,body_text,body_html,body_version)
		VALUES('legacy-mail',?,?,7,1,'legacy subject','','',1,1,1,10,'legacy text','<p>legacy HTML</p>',1)`, account.ID, cursor.ID)
	if err != nil {
		t.Fatal(err)
	}
	bytes := []byte("legacy attachment")
	digest := sha256.Sum256(bytes)
	hash := hex.EncodeToString(digest[:])
	if _, err := legacy.writeContent(hash, bytes); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO mail_attachment(id,mail_id,filename,mime,size_bytes,content_hash,content_id)
		VALUES('legacy-attachment','legacy-mail','a.txt','text/plain',?,?, 'logo@test')`, len(bytes), hash); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	store, err := Open(t.Context(), dir)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := store.Close(); err != nil {
			t.Error(err)
		}
	}()
	got, err := store.ReadMail(t.Context(), "legacy-mail")
	if err != nil || !got.Read || !got.Starred || !got.Cached || got.Body != "legacy text" ||
		got.RawHTML != "<p>legacy HTML</p>" || len(got.Attachments) != 1 || got.Attachments[0].ID != "legacy-attachment" {
		t.Fatalf("迁移破坏邮件或附件引用：%v / %+v", err, got)
	}
	data, _, err := store.ReadAttachment(t.Context(), "legacy-attachment")
	if err != nil || string(data) != string(bytes) {
		t.Fatalf("迁移后附件不可读：%v", err)
	}
	if err := store.SaveMailBody(t.Context(), "legacy-mail", domain.DecodedMail{HTML: strings.Repeat("x", domain.MaxMessageTextBytes)}); err != nil {
		t.Fatalf("8 MiB 完整 HTML 未保存：%v", err)
	}
	for _, size := range []int64{domain.MaxAttachmentBytes, domain.MaxAttachmentBytes + 1} {
		_, err := store.db.Exec(`INSERT INTO mail_attachment(id,mail_id,filename,mime,size_bytes,content_hash)
			VALUES(?,'legacy-mail','large.bin','application/octet-stream',?,?)`, fmt.Sprintf("large-%d", size), size, hash)
		if (size == domain.MaxAttachmentBytes && err != nil) || (size > domain.MaxAttachmentBytes && err == nil) {
			t.Fatalf("附件数据库边界错误：%d / %v", size, err)
		}
	}
	rows, err := store.db.Query("PRAGMA foreign_key_check")
	if err != nil {
		t.Fatal(err)
	}
	if rows.Next() {
		t.Fatal("迁移留下外键问题")
	}
	if err := rows.Close(); err != nil {
		t.Fatal(err)
	}
	backups, err := filepath.Glob(filepath.Join(dir, "backups", "pre-migration-v0005-*.db"))
	if err != nil || len(backups) != 1 {
		t.Fatal("缺少当前目标版本的迁移前备份")
	}
	backup, err := sql.Open("sqlite", databaseURI(backups[0]))
	if err != nil {
		t.Fatal(err)
	}
	var oldText string
	var attachments, version int
	if err := backup.QueryRow("SELECT body_text FROM mail_message WHERE id='legacy-mail'").Scan(&oldText); err != nil {
		t.Fatal(err)
	}
	if err := backup.QueryRow("SELECT COUNT(*) FROM mail_attachment").Scan(&attachments); err != nil {
		t.Fatal(err)
	}
	if err := backup.QueryRow("SELECT MAX(version) FROM schema_migration").Scan(&version); err != nil {
		t.Fatal(err)
	}
	if err := backup.Close(); err != nil {
		t.Fatal(err)
	}
	if oldText != "legacy text" || attachments != 1 || version != 3 {
		t.Fatal("备份不是完整升级前数据库")
	}
}

func TestLargeMailMigrationFailureRollsBackSchemaAndData(t *testing.T) {
	dir := t.TempDir()
	db, err := sql.Open("sqlite", databaseURI(filepath.Join(dir, "omnimail.db")))
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := db.Close(); err != nil {
			t.Error(err)
		}
	}()
	old := fstest.MapFS{}
	for _, name := range []string{"0001_accounts.sql", "0002_mail.sql", "0003_rich_mail.sql"} {
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
	_, err = db.Exec(`INSERT INTO mail_message
		(id,account_id,mailbox_id,uid_validity,uid,subject,from_addr,to_addrs,received_at,is_read,is_starred,size_bytes,body_text,body_html)
		VALUES('legacy-mail',?,?,7,1,'legacy','','',1,0,0,1,'retained','retained HTML')`, account.ID, cursor.ID)
	if err != nil {
		t.Fatal(err)
	}
	upgrade, err := migrationFiles.ReadFile("migrations/0004_large_mail.sql")
	if err != nil {
		t.Fatal(err)
	}
	old["migrations/0004_large_mail.sql"] = &fstest.MapFile{Data: []byte(strings.Replace(string(upgrade), "UPDATE mail_attachment SET size_bytes=size_bytes_legacy;", "UPDATE missing_table SET size_bytes=0;", 1))}
	if err := migrate(t.Context(), db, dir, old); err == nil {
		t.Fatal("损坏迁移被错误接受")
	}
	var html string
	var version int
	if err := db.QueryRow("SELECT body_html FROM mail_message WHERE id='legacy-mail'").Scan(&html); err != nil || html != "retained HTML" {
		t.Fatal("失败迁移破坏原始 HTML")
	}
	if err := db.QueryRow("SELECT MAX(version) FROM schema_migration").Scan(&version); err != nil || version != 3 {
		t.Fatal("失败迁移错误登记版本")
	}
	if _, err := db.Exec("SELECT body_error_code FROM mail_message"); err == nil {
		t.Fatal("失败迁移留下半更新列")
	}
}
