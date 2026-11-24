package syncer

import (
	"strings"
	"testing"
	"time"

	"omnimail/internal/mailproto"
	"omnimail/internal/search"
	"omnimail/internal/storage"
)

func TestIngestNonInlineAttachmentWithContentIDMatchesCID(t *testing.T) {
	dir := t.TempDir()
	db, err := storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatalf("OpenProfileDB: %v", err)
	}
	defer storage.CheckpointAndClose(db)
	blobs := storage.NewBlobStore(dir)

	_, err = db.Exec(`INSERT INTO accounts(id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
		VALUES ('acc-cid','Work','W','me@example.com','imap','IMAP','imap','imap.example.com',993,'SSL/TLS','smtp.example.com',465,'SSL/TLS',1)`)
	if err != nil {
		t.Fatalf("insert account: %v", err)
	}

	pngBytes := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00}

	// 场景 1：Outlook/QQ 邮箱发送的附件无 inline 标记，但携带混合大小写 Content-ID 且被 HTML 引用
	msgID, created, err := IngestMessage(db, blobs, nil, IngestInput{
		AccountID: "acc-cid", AccountEmail: "me@example.com", Folder: "inbox",
		ReceivedAt: time.Now(),
		Parsed: &mailproto.ParsedEmail{
			RFCMessageID: "cid-case-1@outlook.com",
			Subject:      "Outlook 内嵌图测试",
			Sender:       mailproto.EmailAddress{Name: "Alice", Email: "alice@outlook.com"},
			To:           []mailproto.EmailAddress{{Email: "me@example.com"}},
			BodyHTML:     `<p>请看下图：<img src="cid:IMG_Hero%40Outlook.COM" alt="banner" /></p>`,
			Attachments: []mailproto.ParsedAttachment{
				{
					PartID: "2", Filename: "banner.png", Ext: "PNG",
					MimeType: "image/png", ContentID: "<img_hero@outlook.com>",
					IsInline: false, Kind: "image", Data: pngBytes,
				},
				{
					PartID: "3", Filename: "spec.pdf", Ext: "PDF",
					MimeType: "application/pdf", ContentID: "",
					IsInline: false, Kind: "pdf", Data: []byte("%PDF-1.4"),
				},
			},
		},
	})
	if err != nil || !created {
		t.Fatalf("IngestMessage failed: id=%s created=%v err=%v", msgID, created, err)
	}

	detail, err := search.GetThreadDetail(db, msgID, true)
	if err != nil {
		t.Fatalf("GetThreadDetail: %v", err)
	}
	if len(detail.Messages) == 0 {
		t.Fatalf("detail messages empty")
	}
	htmlBody := detail.Messages[0].BodyHTML
	if !strings.Contains(htmlBody, `src="/omnimail-cid/`+msgID+`-att-1"`) || !strings.Contains(htmlBody, `data-omnimail-cid="`+msgID+`-att-1"`) {
		t.Fatalf("无 inline 标记的 cid 附件未被正确改写进正文: %s", htmlBody)
	}
	if len(detail.Attachments) != 1 || detail.Attachments[0].Name != "spec.pdf" {
		t.Fatalf("被正文引用的 cid 图不应重复出现在底部普通附件栏，实际: %+v", detail.Attachments)
	}

	// 场景 2：纯文本邮件携带带 Content-ID 但未标记 inline 的附件，应在附件栏保留展示
	plainID, _, err := IngestMessage(db, blobs, nil, IngestInput{
		AccountID: "acc-cid", AccountEmail: "me@example.com", Folder: "inbox",
		ReceivedAt: time.Now(),
		Parsed: &mailproto.ParsedEmail{
			RFCMessageID: "cid-plain-2@outlook.com",
			Subject:      "纯文本带 CID 附件",
			Sender:       mailproto.EmailAddress{Name: "Bob", Email: "bob@outlook.com"},
			To:           []mailproto.EmailAddress{{Email: "me@example.com"}},
			BodyText:     "请查收附件图片",
			Attachments: []mailproto.ParsedAttachment{
				{
					PartID: "2", Filename: "photo.png", Ext: "PNG",
					MimeType: "image/png", ContentID: "photo@outlook.com",
					IsInline: false, Kind: "image", Data: pngBytes,
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("IngestMessage plain failed: %v", err)
	}
	plainDetail, err := search.GetThreadDetail(db, plainID, true)
	if err != nil {
		t.Fatalf("GetThreadDetail plain: %v", err)
	}
	if len(plainDetail.Attachments) != 1 || plainDetail.Attachments[0].Name != "photo.png" {
		t.Fatalf("无 HTML 正文时带 Content-ID 的普通附件应保留在附件栏: %+v", plainDetail.Attachments)
	}
}
