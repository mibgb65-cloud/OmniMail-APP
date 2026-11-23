package contacts

import (
	"testing"
	"time"

	"omnimail/internal/mailproto"
	"omnimail/internal/storage"
)

func TestContactExtractMergeVCardAndBlacklist(t *testing.T) {
	db, err := storage.OpenProfileDB(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)

	_, _ = db.Exec(`INSERT INTO accounts(id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
		VALUES ('acc-1','Work','工作','me@corp.com','imap','IMAP','password','imap.corp.com',993,'SSL/TLS','smtp.corp.com',465,'SSL/TLS',1000)`)

	// 1. 自动提取跳过 noreply 与自身，并统计往来计数
	ExtractFromMessage(db, "acc-1", "me@corp.com", &mailproto.ParsedEmail{
		Sender: mailproto.EmailAddress{Name: "", Email: "alice@partner.com"},
		To: []mailproto.EmailAddress{
			{Name: "No Reply", Email: "noreply@github.com"},
			{Name: "Me", Email: "me@corp.com"},
		},
		SentAt: time.Now(),
	})
	ExtractFromMessage(db, "acc-1", "me@corp.com", &mailproto.ParsedEmail{
		Sender: mailproto.EmailAddress{Name: "Alice Zhang", Email: "alice@partner.com"},
		SentAt: time.Now(),
	})

	list, err := ListContacts(db, ContactQuery{})
	if err != nil || len(list) != 1 {
		t.Fatalf("expected 1 extracted contact (excluding noreply & self), got %d (%v)", len(list), err)
	}
	if list[0].Name != "Alice Zhang" || list[0].MailCount != 2 {
		t.Fatalf("expected auto-enriched name Alice Zhang & count=2, got %+v", list[0])
	}

	// 2. 用户手动编辑后不再被自动提取覆盖姓名
	saved, err := SaveContact(db, ContactItemDTO{
		ID: list[0].ID, Name: "张总监", Email: "alice@partner.com", Company: "Partner Inc", VIP: true,
	})
	if err != nil {
		t.Fatalf("SaveContact: %v", err)
	}
	ExtractFromMessage(db, "acc-1", "me@corp.com", &mailproto.ParsedEmail{
		Sender: mailproto.EmailAddress{Name: "Other Name", Email: "alice@partner.com"},
	})
	after, _ := SuggestRecipients(db, "partner")
	if len(after) != 1 || after[0].Name != "张总监" {
		t.Fatalf("user_edited name was overwritten: %+v", after)
	}

	// 3. 重复联系人检测与一键合并（+alias 别名）
	dup, _ := SaveContact(db, ContactItemDTO{Name: "张总监", Email: "alice+dev@partner.com", Phone: "13800001111"})
	groups, _ := FindDuplicateContacts(db)
	if len(groups) == 0 {
		t.Fatal("expected duplicate group for +alias contact")
	}
	result, err := BatchMergeContacts(db, []ContactMergeGroup{{groups[0].Key, saved.ID, []string{dup.ID}}})
	merged, lookupErr := ListContacts(db, ContactQuery{Keyword: dup.Email})
	if err != nil || lookupErr != nil || result.Removed != 1 || len(merged) != 1 ||
		merged[0].Phone != "13800001111" || len(merged[0].AlternateEmails) != 1 {
		t.Fatalf("批量合并失败：%+v, %v, %v", result, err, lookupErr)
	}

	// 4. vCard 导入与导出闭环
	vcf := "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Bob Lee\r\nEMAIL:bob@acme.io\r\nORG:Acme\r\nEND:VCARD\r\n"
	impRes, err := ImportVCardContent(db, "acc-1", vcf)
	if err != nil || impRes.Imported != 1 {
		t.Fatalf("ImportVCardContent failed: %+v, err=%v", impRes, err)
	}
	exported, err := ExportVCardContent(db, nil)
	if err != nil || len(exported) == 0 {
		t.Fatalf("ExportVCardContent failed: %v", err)
	}

	// 5. 域名与子域名黑名单拦截计数
	if _, err := AddBlacklist(db, "spammer.org", "domain", "垃圾推广"); err != nil {
		t.Fatalf("AddBlacklist: %v", err)
	}
	tx, _ := db.Begin()
	hitSub := CheckAndCountBlocked(tx, "bot@mail.spammer.org")
	hitClean := CheckAndCountBlocked(tx, "friend@clean.org")
	_ = tx.Commit()
	if !hitSub || hitClean {
		t.Fatalf("blacklist subdomain check mismatch: hitSub=%v hitClean=%v", hitSub, hitClean)
	}
	bl, _ := ListBlacklist(db)
	if len(bl) != 1 || bl[0].BlockedCount != 1 {
		t.Fatalf("expected blocked_count=1, got %+v", bl)
	}
}
