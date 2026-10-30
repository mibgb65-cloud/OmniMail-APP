package service

import (
	"context"
	"errors"
	"testing"

	"omnimail/desktop/internal/domain"
)

type flagTransport struct {
	fakeTransport
	failure error
	starred bool
	calls   int
}

func (f *flagTransport) Connect(ctx context.Context, endpoint domain.AccountEndpoint, secret []byte) (domain.MailSession, error) {
	if f.authError != nil {
		return nil, f.authError
	}
	return &flagSession{transport: f}, nil
}

type flagSession struct {
	fakeSession
	transport *flagTransport
}

func (s *flagSession) SetStarred(mailbox string, validity, uid uint32, starred bool) error {
	s.transport.calls++
	if mailbox != "INBOX" || validity != 7 || uid != 1 {
		return domain.ErrProtocol
	}
	if s.transport.failure != nil {
		return s.transport.failure
	}
	s.transport.starred = starred
	return nil
}
func TestStarredCommitsOnlyAfterServerSuccess(t *testing.T) {
	mail, store, _, _ := testService(t)
	transport := &flagTransport{}
	mail.transport = transport
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	list, err := mail.Messages(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(list) != 1 {
		t.Fatal("测试邮件缺失")
	}
	id := list[0].ID
	if err := mail.SetStarred(t.Context(), id, true); err != nil {
		t.Fatal(err)
	}
	stars, _ := mail.Messages(t.Context(), account.ID, "starred", 0)
	if !transport.starred || len(stars) != 1 || !stars[0].Starred {
		t.Fatal("星标未保存或分类不正确")
	}
	transport.failure = domain.ErrNetwork
	if err := mail.SetStarred(t.Context(), id, false); !errors.Is(err, domain.ErrNetwork) {
		t.Fatal("网络失败未返回")
	}
	detail, _ := store.ReadMail(t.Context(), id)
	if !detail.Starred {
		t.Fatal("远端失败却改动本地星标")
	}
	transport.failure = nil
	if err := mail.SetStarred(t.Context(), id, false); err != nil {
		t.Fatal(err)
	}
	stars, _ = mail.Messages(t.Context(), account.ID, "starred", 0)
	if transport.starred || len(stars) != 0 {
		t.Fatal("取消星标未刷新分类")
	}
	if err := mail.SetStarred(t.Context(), "../bad", true); err == nil {
		t.Fatal("接受非法邮件 ID")
	}
}
