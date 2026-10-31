package repository

import (
	"omnimail/desktop/internal/domain"
	"testing"
)

func TestMovePreservesBodyAttachmentsAndSummaries(t *testing.T) {
	store := openTestStore(t)
	account, _ := seedMailbox(t, store)
	messages, err := store.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil {
		t.Fatal(err)
	}
	id := messages[0].ID
	body := domain.DecodedMail{Text: "保留正文", Attachments: []domain.DecodedAttachment{
		{Filename: "test.txt", MIME: "text/plain", Data: []byte("test")},
	}}
	if err := store.SaveMailBody(t.Context(), id, body); err != nil {
		t.Fatal(err)
	}
	messages, _ = store.PageMail(t.Context(), account.ID, "inbox", 0)
	if !messages[0].HasAttachments {
		t.Fatal("列表缺少附件标记")
	}
	if err := store.UpdateMailRead(t.Context(), id, true); err != nil {
		t.Fatal(err)
	}
	target, err := store.PrepareMailbox(t.Context(), account.ID, domain.RemoteMailbox{Name: "Archive", Kind: "archive"}, 9)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.SaveMailBatch(t.Context(), account.ID, target.ID, 9, 4, 4, []domain.RemoteMessage{{UID: 4}}, nil); err != nil {
		t.Fatal(err)
	}
	if err := store.MoveMail(t.Context(), id, domain.RemoteMailbox{Name: "Archive", Kind: "archive"}, 9, 4); err != nil {
		t.Fatal(err)
	}
	detail, err := store.ReadMail(t.Context(), id)
	if err != nil || detail.Mailbox != "Archive" || detail.Body != body.Text || len(detail.Attachments) != 1 || !detail.Read {
		t.Fatal("移动丢失正文、附件或状态", err)
	}
	data, _, err := store.ReadAttachment(t.Context(), detail.Attachments[0].ID)
	if err != nil || string(data) != "test" {
		t.Fatal("移动后附件不可读")
	}
	archived, err := store.PageMail(t.Context(), account.ID, "archive", 0)
	if err != nil || len(archived) != 1 || archived[0].ID != id {
		t.Fatal("未合并同步先到达的目标副本", err)
	}
}
