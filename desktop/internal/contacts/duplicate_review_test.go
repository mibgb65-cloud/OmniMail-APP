package contacts

import (
	"database/sql"
	"fmt"
	"strings"
	"testing"

	"omnimail/internal/apperr"
	"omnimail/internal/storage"
)

func contactFixture(t *testing.T, db *sql.DB, id, name, email string, count int, vip bool) {
	t.Helper()
	if _, err := db.Exec(`INSERT INTO contacts(id,name,email,mail_count,is_vip,updated_at) VALUES (?,?,?,?,?,1)`,
		id, name, email, count, vip); err != nil {
		t.Fatal(err)
	}
}

func contactTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := storage.OpenProfileDB(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = storage.CheckpointAndClose(db) })
	return db
}

func TestDuplicateReviewCountsSortsAndPersistsIgnore(t *testing.T) {
	dir := t.TempDir()
	db, err := storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	for i := range 50 {
		contactFixture(t, db, fmt.Sprintf("contact-%02d", i), "通知组",
			fmt.Sprintf("noreply_at_example_%042d@icloud.com", i), i, i == 0)
	}
	groups, err := FindDuplicateContacts(db)
	if err != nil || len(groups) != 1 || len(groups[0].Candidates) != 50 ||
		!groups[0].HasRelay || groups[0].Candidates[0].ID != "contact-49" {
		t.Fatalf("重复组应按往来数量而非 VIP 排序：组数=%d，err=%v", len(groups), err)
	}
	if err := IgnoreDuplicateContacts(db, groups[0].Key); err != nil {
		t.Fatal(err)
	}
	_ = storage.CheckpointAndClose(db)
	db, err = storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)
	if groups, err := FindDuplicateContacts(db); err != nil || len(groups) != 0 {
		t.Fatalf("重启后仍提示已忽略的组：组数=%d，err=%v", len(groups), err)
	}
	contactFixture(t, db, "new-contact", "通知组", "noreply_at_example_new@icloud.com", 6, false)
	if groups, err := FindDuplicateContacts(db); err != nil || len(groups) != 1 || len(groups[0].Candidates) != 51 {
		t.Fatalf("新增地址后应重新提示审阅：组数=%d，err=%v", len(groups), err)
	}
}

func TestContactBatchMergeRollbackAndHistory(t *testing.T) {
	db := contactTestDB(t)
	contactFixture(t, db, "main", "Alice 原名", "alice@example.org", 2, false)
	contactFixture(t, db, "alias", "Alice 公司", "alice+team@example.org", 8, true)
	contactFixture(t, db, "keep", "Alice 私人", "alice+personal@example.org", 4, false)
	contactFixture(t, db, "other-main", "Bob", "bob@example.org", 1, false)
	contactFixture(t, db, "other-alias", "Bob", "bobby@example.org", 1, false)
	if _, err := db.Exec(`INSERT INTO contact_aliases(email,contact_id) VALUES ('alice-live@example.org','alias')`); err != nil {
		t.Fatal(err)
	}
	groups, err := FindDuplicateContacts(db)
	if err != nil || len(groups) != 2 {
		t.Fatalf("需要两个重复组：%v", err)
	}
	plan := ContactMergeGroup{GroupKey: groups[0].Key, PrimaryID: "main", DuplicateIDs: []string{"alias"}}
	stale := ContactMergeGroup{GroupKey: groups[1].Key, PrimaryID: "other-main", DuplicateIDs: []string{"keep"}}
	if _, err := BatchMergeContacts(db, []ContactMergeGroup{plan, stale}); apperr.CodeOf(err) != apperr.CodeInvalidInput {
		t.Fatalf("跨组地址应拒绝整批操作：%v", err)
	}
	if rows, err := ListContacts(db, ContactQuery{}); err != nil || len(rows) != 5 {
		t.Fatalf("事务应回滚已执行的第一组合并：记录数=%d，err=%v", len(rows), err)
	}
	result, err := BatchMergeContacts(db, []ContactMergeGroup{plan, {
		GroupKey: groups[1].Key, PrimaryID: "other-main", DuplicateIDs: []string{"other-alias"},
	}})
	if err != nil || result.Groups != 2 || result.Removed != 2 {
		t.Fatalf("有效批量合并失败：%+v，err=%v", result, err)
	}
	got, err := ListContacts(db, ContactQuery{Keyword: "alice-live@example.org"})
	if err != nil || len(got) != 1 || got[0].ID != "main" || got[0].Name != "Alice 原名" ||
		!got[0].VIP || len(got[0].AlternateEmails) != 2 || got[0].MailCount != 10 {
		t.Fatalf("主身份、旧备用邮箱或 VIP 丢失：记录数=%d，err=%v", len(got), err)
	}
	upsertExtractedContact(db, "account", "me@example.org", "新显示名", "alice+team@example.org", 100)
	got, err = ListContacts(db, ContactQuery{Keyword: "alice+team@example.org"})
	if err != nil || len(got) != 1 || got[0].ID != "main" || got[0].MailCount != 11 {
		t.Fatalf("同步再次建立了备用邮箱联系人，或未更新主联系人往来计数：%v", err)
	}
	if rows, err := ListContacts(db, ContactQuery{Keyword: "alice+personal@example.org"}); err != nil || len(rows) != 1 || rows[0].ID != "keep" {
		t.Fatalf("被排除的联系人不得合并：%v", err)
	}
	if _, err := SaveContact(db, ContactItemDTO{Name: "重复联系人", Email: "alice+team@example.org"}); apperr.CodeOf(err) != apperr.CodeInvalidInput {
		t.Fatalf("保存联系人不应重新占用备用邮箱：%v", err)
	}
	testMergedContactHistory(t, db)
}

func testMergedContactHistory(t *testing.T, db *sql.DB) {
	t.Helper()
	for _, stmt := range []string{
		`INSERT INTO accounts(id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
		 VALUES ('acc','Work','工作','me@example.org','imap','IMAP','password','imap.example.org',993,'SSL/TLS','smtp.example.org',465,'SSL/TLS',1)`,
		`INSERT INTO threads(id,account_id,subject,snippet,last_msg_at) VALUES ('thread','acc','主题','摘要',1)`,
		`INSERT INTO messages(id,account_id,thread_id,folder,sender_name,sender_email,subject,body_text,to_json,cc_json,bcc_json,sent_at,received_at)
		 VALUES ('primary','acc','thread','archive','Alice','alice@example.org','主地址','', '[]','[]','[]',1,5),
		        ('alias','acc','thread','inbox','Alice','alice+team@example.org','备用地址','', '[]','[]','[]',1,4),
		        ('sent','acc','thread','sent','Me','me@example.org','已发送','', '[{"email":"Alice+Team@example.org"},{"email":"alice@example.org"}]','[]','[]',1,3),
		        ('bcc','acc','thread','sent','Me','me@example.org','密送','', '[]','[]','[{"email":"alice-live@example.org"}]',1,2),
		        ('other','acc','thread','inbox','Other','not-alice@example.org','不相关','alice@example.org', '[]','[]','[]',1,1)`,
	} {
		if _, err := db.Exec(stmt); err != nil {
			t.Fatal(err)
		}
	}
	page, err := ListContactMailHistory(db, "main", "")
	var ids []string
	for _, row := range page.Items {
		ids = append(ids, row.ID)
	}
	if err != nil || strings.Join(ids, ",") != "primary,alias,sent,bcc" {
		t.Fatalf("邮件历史应覆盖主地址和所有备用地址，不纳入正文中碰巧出现的地址：%v", err)
	}
}
