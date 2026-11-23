package syncer

import (
	"testing"
	"time"

	"omnimail/internal/mailproto"
	"omnimail/internal/search"
	"omnimail/internal/storage"
)

func TestIngestFTS5TrigramShortChineseFallbackAndSnooze(t *testing.T) {
	dir := t.TempDir()
	db, err := storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)
	blobs := storage.NewBlobStore(dir)

	_, err = db.Exec(`INSERT INTO accounts(id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
		VALUES ('acc-1','Work','工作','me@studio.example','imap','IMAP','imap','imap.example',993,'SSL/TLS','smtp.example',465,'SSL/TLS',1)`)
	if err != nil {
		t.Fatal(err)
	}

	m1ID, created, err := IngestMessage(db, blobs, nil, IngestInput{
		AccountID: "acc-1", AccountEmail: "me@studio.example", RemoteMailboxID: "acc-1:INBOX", RemoteUID: 101,
		Folder: "inbox", IsUnread: true, ReceivedAt: time.Now(),
		Parsed: &mailproto.ParsedEmail{
			RFCMessageID: "m101@ex", Subject: "十一月云服务账单与发票核对",
			Sender: mailproto.EmailAddress{Name: "财务中心", Email: "billing@cloud.example"},
			To:     []mailproto.EmailAddress{{Name: "Me", Email: "me@studio.example"}},
			SentAt: time.Now(), BodyText: "请查收附件中的季度费用明细。",
			Attachments: []mailproto.ParsedAttachment{{PartID: "2", Filename: "invoice.pdf", Ext: "pdf", MimeType: "application/pdf", Kind: "pdf", Data: []byte("pdf")}},
		},
	})
	if err != nil || !created || m1ID == "" {
		t.Fatalf("IngestMessage 失败: id=%q created=%v err=%v", m1ID, created, err)
	}

	// 1. >=3 字符走 FTS5 trigram
	res3, err := search.ListMessages(db, search.MailSearchQuery{Keyword: "云服务账单"}, true)
	if err != nil || len(res3.Items) != 1 {
		t.Fatalf("FTS5 trigram 长词检索失败: count=%d err=%v", len(res3.Items), err)
	}

	// 2. 2 字中文短词（trigram 不满 3 字）自动降级 LIKE 100% 召回
	resShort, err := search.ListMessages(db, search.MailSearchQuery{Keyword: "from:cloud 账单 has:attachment"}, true)
	if err != nil || len(resShort.Items) != 1 {
		t.Fatalf("2 字中文短词降级 + 语法算子检索失败: count=%d err=%v", len(resShort.Items), err)
	}

	// 3. Snooze 到期自动唤醒回 inbox
	if err := SnoozeLocal(db, []string{m1ID}, time.Now().Add(-time.Second).UnixMilli()); err != nil {
		t.Fatal(err)
	}
	woke := wakeDueSnoozed(db)
	if len(woke) != 1 || woke[0] != m1ID {
		t.Fatalf("Snooze 唤醒器未恢复到期邮件: %+v", woke)
	}
}
