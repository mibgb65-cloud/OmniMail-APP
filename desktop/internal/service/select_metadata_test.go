package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
)

type selectedMetadataSession struct {
	fakeSession
	validity, next uint32
}

type emptySelectedMailbox struct{ fakeSession }

func (emptySelectedMailbox) Select(string) (uint32, uint32, error)                  { return 7, 1, nil }
func (emptySelectedMailbox) LocateUID(uint32) (uint32, bool, error)                 { return 0, false, nil }
func (emptySelectedMailbox) Headers(uint32, uint32) ([]domain.RemoteMessage, error) { return nil, nil }

type emptySelectedTransport struct{ fakeTransport }

func (emptySelectedTransport) Connect(context.Context, domain.AccountEndpoint, []byte) (domain.MailSession, error) {
	return emptySelectedMailbox{}, nil
}

func TestEmptyMailboxUpperBoundStillReconcilesPreviouslyStoredUIDs(t *testing.T) {
	mail, store, _, _ := testService(t)
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal("无法准备合成账号")
	}
	awaitSync(t, mail, account.ID)
	rows, err := store.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(rows) != 1 {
		t.Fatal("缺少合成旧镜像")
	}
	mail.transport = &emptySelectedTransport{}
	ctx, cancel := context.WithTimeout(t.Context(), time.Minute)
	defer cancel()
	more, err := mail.syncAccount(ctx, account.ID)
	if err != nil || more {
		t.Fatal("空邮箱核对不应伪装失败或无限续排")
	}
	rows, err = store.PageMail(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(rows) != 0 {
		t.Fatal("UID 搜索得到空邮箱后未核对本地旧 UID")
	}
}

func (s selectedMetadataSession) Select(string) (uint32, uint32, error) {
	return s.validity, s.next, nil
}

func TestSelectMissingMetadataHasSafeReason(t *testing.T) {
	for _, test := range []struct {
		validity, next uint32
		reason         string
	}{
		{0, 1, "missing_uidvalidity"},
		{7, 0, "missing_uidnext"},
	} {
		t.Run(test.reason, func(t *testing.T) {
			mail, _, _, _ := testService(t)
			_, err := mail.syncMailbox(t.Context(), "synthetic-account",
				domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"},
				selectedMetadataSession{validity: test.validity, next: test.next})
			var diagnostic interface{ DiagnosticCode() string }
			if !errors.Is(err, domain.ErrProtocol) || !errors.As(err, &diagnostic) || diagnostic.DiagnosticCode() != test.reason {
				t.Fatal("选择阶段缺失元数据被混同为邮件格式错误")
			}
		})
	}
}
