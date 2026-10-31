package repository

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestRichBodyRoundTripAndPrivateRawHTML(t *testing.T) {
	store := openTestStore(t)
	account, _ := seedMailbox(t, store)
	list, err := store.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil {
		t.Fatal(err)
	}
	body := domain.DecodedMail{Text: "文本", HTML: "<p>原始 HTML<img src=\"cid:logo@test\"></p>",
		Attachments: []domain.DecodedAttachment{{Filename: "logo.png", MIME: "image/png", ContentID: "logo@test", Data: []byte("bytes")}}}
	if err := store.SaveMailBody(t.Context(), list[0].ID, body); err != nil {
		t.Fatal(err)
	}
	detail, err := store.ReadMail(t.Context(), list[0].ID)
	if err != nil || detail.RawHTML != body.HTML || detail.BodyVersion != 1 ||
		len(detail.Attachments) != 1 || detail.Attachments[0].ContentID != "logo@test" {
		t.Fatalf("富正文未往返：%v", err)
	}
	serialized, err := json.Marshal(detail)
	if err != nil || strings.Contains(string(serialized), "原始 HTML") {
		t.Fatal("原始 HTML 泄漏到 IPC")
	}
}

func TestRichBodyRejectsInvalidInputWithoutReplacingCache(t *testing.T) {
	store := openTestStore(t)
	account, _ := seedMailbox(t, store)
	list, _ := store.PageMail(t.Context(), account.ID, "inbox", 0)
	id := list[0].ID
	if err := store.SaveMailBody(t.Context(), id, domain.DecodedMail{Text: "保留文本"}); err != nil {
		t.Fatal(err)
	}
	if err := store.SaveMailBody(t.Context(), id, domain.DecodedMail{HTML: strings.Repeat("x", (1<<20)+1)}); !errors.Is(err, domain.ErrTooLarge) {
		t.Fatal("未限制 HTML 大小")
	}
	bad := domain.DecodedMail{Text: "不应替换", Attachments: []domain.DecodedAttachment{
		{Filename: "a.png", MIME: "image/png", ContentID: "bad\r\ncid", Data: []byte("bad")}}}
	if err := store.SaveMailBody(t.Context(), id, bad); err == nil {
		t.Fatal("未拒绝非法 CID")
	}
	detail, _ := store.ReadMail(t.Context(), id)
	if detail.Body != "保留文本" {
		t.Fatal("失败升级丢失旧缓存")
	}
}
