package service

import (
	"context"
	"errors"
	"strings"
	"sync/atomic"
	"testing"

	"omnimail/desktop/internal/domain"
)

type passwordCheckingTransport struct {
	fakeTransport
	wantIMAP   string
	wantSMTP   string
	imapChecks atomic.Int32
	smtpChecks atomic.Int32
}

func (p *passwordCheckingTransport) Connect(ctx context.Context, endpoint domain.AccountEndpoint, secret []byte) (domain.MailSession, error) {
	p.imapChecks.Add(1)
	if string(secret) != p.wantIMAP {
		return nil, domain.ErrAuthentication
	}
	return p.fakeTransport.Connect(ctx, endpoint, secret)
}

func (p *passwordCheckingTransport) CheckSMTP(ctx context.Context, endpoint domain.AccountEndpoint, secret []byte) error {
	p.smtpChecks.Add(1)
	if string(secret) != p.wantSMTP {
		return domain.ErrAuthentication
	}
	return p.fakeTransport.CheckSMTP(ctx, endpoint, secret)
}

func TestAccountAppPasswordNormalization(t *testing.T) {
	for _, provider := range []string{"gmail", "qq", "netease_163", "netease_126", "custom"} {
		t.Run(provider, func(t *testing.T) {
			mail, store, secrets, _ := testService(t)
			input := addInput()
			input.ProviderCode = provider
			input.IMAP.Password = " abcd efgh ijkl mnop "
			input.SMTP.Password = " ponm lkji hgfe dcba "
			wantIMAP, wantSMTP := input.IMAP.Password, input.SMTP.Password
			if provider == "gmail" {
				wantIMAP, wantSMTP = "abcdefghijklmnop", "ponmlkjihgfedcba"
			}
			transport := &passwordCheckingTransport{wantIMAP: wantIMAP, wantSMTP: wantSMTP}
			mail.transport = transport
			account, err := mail.AddAccount(t.Context(), input)
			if err != nil {
				t.Fatalf("应用密码验证失败：%v", err)
			}
			if transport.imapChecks.Load() < 1 || transport.smtpChecks.Load() != 1 {
				t.Fatal("未分别验证收发信密码")
			}
			saved, err := store.GetAccount(t.Context(), account.ID)
			if err != nil {
				t.Fatal("无法读取已保存的合成账号")
			}
			for i, want := range []string{wantIMAP, wantSMTP} {
				secret, err := secrets.Get(t.Context(), saved.Endpoints[i].CredentialRef)
				if err != nil || string(secret) != want {
					t.Fatal("保存的凭据与认证使用的凭据不同")
				}
			}
		})
	}
}

func TestGmailAppPasswordValidationBeforeNetwork(t *testing.T) {
	for _, test := range []struct{ name, password string }{
		{"empty_after_normalization", "    "},
		{"tab", "abcd\tefgh"},
		{"newline", "abcd\nefgh"},
		{"oversize_before_normalization", strings.Repeat(" ", 1024) + "abcd"},
	} {
		t.Run(test.name, func(t *testing.T) {
			mail, store, secrets, _ := testService(t)
			transport := &passwordCheckingTransport{}
			mail.transport = transport
			input := addInput()
			input.ProviderCode = "gmail"
			input.IMAP.Password = test.password
			input.SMTP.Password = test.password
			if _, err := mail.AddAccount(t.Context(), input); !errors.Is(err, domain.ErrCredentialInvalid) {
				t.Fatalf("无效应用密码未拒绝：%v", err)
			}
			accounts, err := store.ListAccounts(t.Context())
			if err != nil || len(accounts) != 0 || secrets.sets != 0 ||
				transport.imapChecks.Load() != 0 || transport.smtpChecks.Load() != 0 {
				t.Fatal("无效密码触发网络或保存")
			}
		})
	}
}
