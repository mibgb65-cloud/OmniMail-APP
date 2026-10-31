package repository

import (
	"database/sql"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"omnimail/desktop/internal/domain"
)

func TestZeroValidityRestrictedToOfficialNaverAccount(t *testing.T) {
	for _, test := range []struct {
		provider, host string
		allowed        bool
	}{
		{"naver", "imap.naver.com", true},
		{"naver", "IMAP.NAVER.COM.", true},
		{"naver", "imap.naver.com.evil.invalid", false},
		{"custom", "imap.naver.com", false},
	} {
		t.Run(test.provider+"_"+test.host, func(t *testing.T) {
			store := openTestStore(t)
			input := accountInput(test.provider)
			input.Endpoints[0].Host = test.host
			account := createTestAccount(t, store, input)
			box := domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}
			cursor, err := store.PrepareMailbox(t.Context(), account.ID, box, 0)
			if !test.allowed {
				if err == nil {
					t.Fatal("零值兼容越过 NAVER 官方端点边界")
				}
				if _, err := store.db.Exec(`INSERT INTO mailbox(id,account_id,remote_name,kind,uid_validity)
					VALUES('forbidden-zero',?,'INBOX','inbox',0)`, account.ID); err == nil {
					t.Fatal("直接 SQL 绕过零值账号约束")
				}
				return
			}
			if err != nil {
				t.Fatal("明确的 NAVER 零值未能保存")
			}
			message := domain.RemoteMessage{UID: 1, MessageID: "one@example.invalid", Subject: "one", ReceivedAt: 1, Size: 20}
			save := func() {
				t.Helper()
				if err := store.SaveMailBatch(t.Context(), account.ID, cursor.ID, 0, 1, 1, []domain.RemoteMessage{message}, nil); err != nil {
					t.Fatal(err)
				}
			}
			save()
			first, err := store.PageMail(t.Context(), account.ID, "inbox", 0)
			if err != nil || len(first) != 1 {
				t.Fatal("零值邮件未保存")
			}
			if err := store.SaveMailBody(t.Context(), first[0].ID, domain.DecodedMail{Text: "old cached body",
				Attachments: []domain.DecodedAttachment{{Filename: "test.txt", MIME: "text/plain", Data: []byte("attachment")}}}); err != nil {
				t.Fatal(err)
			}
			message.Starred = true
			save()
			unchanged, err := store.ReadMail(t.Context(), first[0].ID)
			if err != nil || !unchanged.Cached || !unchanged.Starred || len(unchanged.Attachments) != 1 {
				t.Fatal("仅标记变化不应丢失缓存")
			}
			message.MessageID = "two@example.invalid"
			save()
			reused, err := store.PageMail(t.Context(), account.ID, "inbox", 0)
			if err != nil || len(reused) != 1 || reused[0].ID == first[0].ID || reused[0].Cached || reused[0].HasAttachments {
				t.Fatal("UID 重用继承了旧正文、旧实例 ID 或附件")
			}
			if _, err := store.ReadMail(t.Context(), first[0].ID); err == nil {
				t.Fatal("旧正文仍能通过已失效实例 ID 读取")
			}
		})
	}
}

func TestZeroValidityMigrationPreservesCacheAndBacksUpVersionFour(t *testing.T) {
	dir := t.TempDir()
	db, err := sql.Open("sqlite", databaseURI(filepath.Join(dir, "omnimail.db")))
	if err != nil {
		t.Fatal(err)
	}
	old := fstest.MapFS{}
	for _, name := range []string{"0001_accounts.sql", "0002_mail.sql", "0003_rich_mail.sql", "0004_large_mail.sql"} {
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
	if err := legacy.SaveMailBatch(t.Context(), account.ID, cursor.ID, 7, 1, 1,
		[]domain.RemoteMessage{{UID: 1, Subject: "fixture", Read: true, Starred: true}}, nil); err != nil {
		t.Fatal(err)
	}
	rows, err := legacy.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(rows) != 1 {
		t.Fatal("缺少迁移夹具")
	}
	id := rows[0].ID
	if err := legacy.SaveMailBody(t.Context(), id, domain.DecodedMail{Text: "before", HTML: "<p>before</p>",
		Attachments: []domain.DecodedAttachment{{Filename: "test.txt", MIME: "text/plain", Data: []byte("before")}}}); err != nil {
		t.Fatal(err)
	}
	upgrade, err := migrationFiles.ReadFile("migrations/0005_zero_uidvalidity.sql")
	if err != nil {
		t.Fatal(err)
	}
	old["migrations/0005_zero_uidvalidity.sql"] = &fstest.MapFile{
		Data: []byte(strings.Replace(string(upgrade), "CREATE INDEX idx_message_account_time ON mail_message(",
			"CREATE INDEX idx_message_account_time ON missing_table(", 1)),
	}
	if err := migrate(t.Context(), db, dir, old); err == nil {
		t.Fatal("故意损坏的 v5 迁移未失败")
	}
	var previousVersion int
	if err := db.QueryRow("SELECT max(version) FROM schema_migration").Scan(&previousVersion); err != nil || previousVersion != 4 {
		t.Fatal("失败迁移未回滚版本")
	}
	retained, err := legacy.ReadMail(t.Context(), id)
	if err != nil || retained.Body != "before" || len(retained.Attachments) != 1 {
		t.Fatal("子表重建中途失败丢失缓存")
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
	detail, err := store.ReadMail(t.Context(), id)
	if err != nil || detail.Body != "before" || detail.RawHTML != "<p>before</p>" ||
		!detail.Read || !detail.Starred || detail.BodyVersion != 1 || len(detail.Attachments) != 1 {
		t.Fatal("v5 迁移丢失旧缓存或标记")
	}
	attachment, _, err := store.ReadAttachment(t.Context(), detail.Attachments[0].ID)
	if err != nil || string(attachment) != "before" {
		t.Fatal("迁移损坏附件")
	}
	backups, err := filepath.Glob(filepath.Join(dir, "backups", "pre-migration-v0005-*.db"))
	if err != nil || len(backups) != 2 {
		t.Fatal("没有 v5 迁移前备份")
	}
	backup, err := sql.Open("sqlite", databaseURI(backups[0]))
	if err != nil {
		t.Fatal(err)
	}
	var version int
	queryErr := backup.QueryRow("SELECT max(version) FROM schema_migration").Scan(&version)
	closeErr := backup.Close()
	if queryErr != nil || closeErr != nil || version != 4 {
		t.Fatal("备份不是迁移前的 v4 数据库")
	}
	var violations int
	if err := store.db.QueryRow("SELECT count(*) FROM pragma_foreign_key_check").Scan(&violations); err != nil || violations != 0 {
		t.Fatal("迁移留下外键问题")
	}
}
