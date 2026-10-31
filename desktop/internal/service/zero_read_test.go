package service

import (
	"context"
	"errors"
	"testing"

	"omnimail/desktop/internal/domain"
)

type verifiedReadTransport struct {
	fakeTransport
	calls    int
	expected domain.RemoteMessage
	wanted   bool
	failure  error
	after    func()
}

func (f *verifiedReadTransport) Connect(context.Context, domain.AccountEndpoint, []byte) (domain.MailSession, error) {
	return &verifiedReadSession{owner: f}, nil
}

type verifiedReadSession struct {
	fakeSession
	owner *verifiedReadTransport
}

func (s *verifiedReadSession) SetReadVerified(mailbox string, expected domain.RemoteMessage, read bool) error {
	s.owner.calls++
	if mailbox != "INBOX" || !s.owner.expected.SameIdentity(expected) {
		return domain.ErrProtocol
	}
	s.owner.wanted = read
	if s.owner.after != nil {
		s.owner.after()
	}
	return s.owner.failure
}

func TestZeroReadUsesVerifiedCapabilityAndCommitsOnlyOnSuccess(t *testing.T) {
	mail, store, accountID, cursor := zeroMailbox(t)
	expected := domain.RemoteMessage{UID: 1, MessageID: "verified@example.invalid", Subject: "fixture",
		From: "sender@example.invalid", To: "reader@example.invalid", ReceivedAt: 1, Size: 20}
	if err := store.SaveMailBatch(t.Context(), accountID, cursor.ID, 0, 1, 1, []domain.RemoteMessage{expected}, nil); err != nil {
		t.Fatal(err)
	}
	rows, err := store.PageMail(t.Context(), accountID, "inbox", 0)
	if err != nil || len(rows) != 1 {
		t.Fatal("缺少已读测试摘要")
	}
	id := rows[0].ID
	transport := &verifiedReadTransport{expected: expected}
	mail.transport = transport
	if err := mail.SetRead(t.Context(), id, true); err != nil {
		t.Fatal("NAVER 经验证的已读能力仍被全局零值保护拦截")
	}
	detail, err := store.ReadMail(t.Context(), id)
	if err != nil || !detail.Read || !transport.wanted || transport.calls != 1 {
		t.Fatal("已读没有经远端确认后保存")
	}
	transport.failure = domain.ErrNetwork
	if err := mail.SetRead(t.Context(), id, false); !errors.Is(err, domain.ErrNetwork) {
		t.Fatal("远端失败未返回")
	}
	detail, err = store.ReadMail(t.Context(), id)
	if err != nil || !detail.Read {
		t.Fatal("远端失败仍更新了本地已读")
	}
	transport.failure = nil
	if err := mail.SetRead(t.Context(), id, false); err != nil {
		t.Fatal(err)
	}
	detail, err = store.ReadMail(t.Context(), id)
	if err != nil || detail.Read {
		t.Fatal("手动标为未读没有确认落库")
	}
	if err := mail.SetStarred(t.Context(), id, true); !errors.Is(err, domain.ErrActionUnsupported) {
		t.Fatal("已读修复意外放宽零值星标")
	}
	if err := mail.MoveMessage(t.Context(), id, "deleted"); !errors.Is(err, domain.ErrActionUnsupported) {
		t.Fatal("已读修复意外放宽零值移动")
	}
	if transport.calls != 3 {
		t.Fatal("非已读操作触发了已读验证能力")
	}
}

func TestZeroReadRevalidatesOfficialEndpointBeforeConnecting(t *testing.T) {
	for _, test := range []struct {
		name string
		edit func(*domain.Account)
	}{
		{"provider", func(a *domain.Account) { a.ProviderCode = "custom" }},
		{"host", func(a *domain.Account) { a.Endpoints[0].Host = "imap.naver.com.evil.invalid" }},
		{"port", func(a *domain.Account) { a.Endpoints[0].Port = 1993 }},
		{"tls", func(a *domain.Account) { a.Endpoints[0].TLSMode = domain.TLSStartTLS }},
	} {
		t.Run(test.name, func(t *testing.T) {
			mail, store, accountID, cursor := zeroMailbox(t)
			if err := store.SaveMailBatch(t.Context(), accountID, cursor.ID, 0, 1, 1,
				[]domain.RemoteMessage{{UID: 1}}, nil); err != nil {
				t.Fatal(err)
			}
			rows, err := store.PageMail(t.Context(), accountID, "inbox", 0)
			if err != nil || len(rows) != 1 {
				t.Fatal("缺少零值邮件")
			}
			account, err := store.GetAccount(t.Context(), accountID)
			if err != nil {
				t.Fatal(err)
			}
			test.edit(&account)
			if _, err := store.UpdateAccount(t.Context(), account); err != nil {
				t.Fatal(err)
			}
			transport := &verifiedReadTransport{}
			mail.transport = transport
			if !errors.Is(mail.SetRead(t.Context(), rows[0].ID, true), domain.ErrActionUnsupported) || transport.calls != 0 {
				t.Fatal("已更换端点/服务商的旧零值实例仍然可写")
			}
		})
	}
}

func TestZeroReadDoesNotCommitToReplacedLocalInstance(t *testing.T) {
	mail, store, accountID, cursor := zeroMailbox(t)
	expected := domain.RemoteMessage{UID: 1, MessageID: "old@example.invalid", Subject: "old", Size: 20}
	save := func(message domain.RemoteMessage) {
		t.Helper()
		if err := store.SaveMailBatch(t.Context(), accountID, cursor.ID, 0, 1, 1, []domain.RemoteMessage{message}, nil); err != nil {
			t.Fatal(err)
		}
	}
	save(expected)
	rows, err := store.PageMail(t.Context(), accountID, "inbox", 0)
	if err != nil || len(rows) != 1 {
		t.Fatal("缺少旧实例")
	}
	oldID := rows[0].ID
	mail.transport = &verifiedReadTransport{expected: expected, after: func() {
		reused := expected
		reused.MessageID = "replacement@example.invalid"
		save(reused)
	}}
	if !errors.Is(mail.SetRead(t.Context(), oldID, true), domain.ErrActionUncertain) {
		t.Fatal("远端写入后本地实例已替换仍宣称成功")
	}
	rows, err = store.PageMail(t.Context(), accountID, "inbox", 0)
	if err != nil || len(rows) != 1 || rows[0].ID == oldID || rows[0].Read {
		t.Fatal("旧实例写入污染了新实例已读状态")
	}
}
