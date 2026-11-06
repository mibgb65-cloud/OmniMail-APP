package service

import (
	"context"
	"errors"
	"testing"

	"omnimail/desktop/internal/domain"
)

type failedMailCounts struct{ domain.MailRepository }

var errMailCounts = errors.New("STORAGE_FAILED")

func (failedMailCounts) MailCounts(context.Context) (map[string]int, error) {
	return nil, errMailCounts
}

func TestAccountSummaryIncludesRealMailCount(t *testing.T) {
	mail, store, _, _ := testService(t)
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	if _, err := store.PrepareMailbox(t.Context(), account.ID, domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, 1); err != nil {
		t.Fatal(err)
	}
	accounts, err := mail.Accounts(t.Context())
	if err != nil || len(accounts) != 1 || accounts[0].MessageCount == nil || *accounts[0].MessageCount != 0 {
		t.Fatalf("空邮箱应返回明确的零计数：%v / %v", accounts, err)
	}
	cursor, err := store.PrepareMailbox(t.Context(), account.ID, domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, 1)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.SaveMailBatch(t.Context(), account.ID, cursor.ID, 1, 1, 2,
		[]domain.RemoteMessage{{UID: 1}, {UID: 2}}, nil); err != nil {
		t.Fatal(err)
	}
	accounts, err = mail.Accounts(t.Context())
	if err != nil || len(accounts) != 1 || accounts[0].MessageCount == nil || *accounts[0].MessageCount != 2 {
		t.Fatalf("摘要未带出本地实际计数：%v / %v", accounts, err)
	}
	mail.store = failedMailCounts{store}
	if _, err := mail.Accounts(t.Context()); !errors.Is(err, errMailCounts) {
		t.Fatalf("计数失败被吞掉或伪装为零：%v", err)
	}
}
