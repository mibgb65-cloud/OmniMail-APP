package service

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/png"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
	"omnimail/desktop/internal/mailrender"
)

func TestMessageSanitizesCachedHTMLAndRefreshFailureKeepsCache(t *testing.T) {
	mail, store, _, transport := testService(t)
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	list, err := mail.Messages(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(list) != 1 {
		t.Fatal("测试邮件未建立")
	}
	id := list[0].ID
	if err := store.SaveMailBody(t.Context(), id, domain.DecodedMail{
		Text: "保留正文", HTML: `<p>内容</p><script>bad()</script><img src="https://images.example.invalid/a.png">`,
	}); err != nil {
		t.Fatal(err)
	}
	got, err := mail.Message(t.Context(), id)
	if err != nil || got.BodyVersion != 1 || strings.Contains(got.BodyHTML, "<script") ||
		!strings.Contains(got.BodyHTML, "data-mail-remote") || got.RawHTML != "" {
		t.Fatal("IPC 未提供安全富正文")
	}
	transport.authError = domain.ErrNetwork
	if _, err := mail.RefreshMessage(t.Context(), id); !errors.Is(err, domain.ErrNetwork) {
		t.Fatal("重取失败未返回安全错误")
	}
	cached, err := mail.Message(t.Context(), id)
	if err != nil || cached.Body != "保留正文" || cached.BodyHTML != got.BodyHTML {
		t.Fatal("重取失败损坏缓存")
	}
}

func TestCIDResolutionOnlyReadsCurrentMessageAttachments(t *testing.T) {
	mail, store, _, _ := testService(t)
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	list, _ := mail.Messages(t.Context(), account.ID, "inbox", 0)
	var data bytes.Buffer
	_ = png.Encode(&data, image.NewGray(image.Rect(0, 0, 2, 2)))
	body := domain.DecodedMail{Text: "图片正文", HTML: `<img src="cid:own@test"><img src="cid:foreign@test">`,
		Attachments: []domain.DecodedAttachment{{Filename: "own.png", MIME: "image/png", ContentID: "own@test", Data: data.Bytes()}}}
	if err := store.SaveMailBody(t.Context(), list[0].ID, body); err != nil {
		t.Fatal(err)
	}
	spy := &attachmentReadSpy{MailRepository: store}
	mail.store = spy
	detail, err := mail.Message(t.Context(), list[0].ID)
	if err != nil || !strings.Contains(detail.BodyHTML, mailrender.ImageData(data.Bytes())) ||
		strings.Count(detail.BodyHTML, "data-mail-image=") != 1 || len(spy.reads) != 1 || spy.reads[0] != detail.Attachments[0].ID {
		t.Fatal("CID 越界读取或合法内嵌图丢失")
	}
}

type attachmentReadSpy struct {
	domain.MailRepository
	reads []string
}

func (s *attachmentReadSpy) ReadAttachment(ctx context.Context, id string) ([]byte, string, error) {
	s.reads = append(s.reads, id)
	return s.MailRepository.ReadAttachment(ctx, id)
}
