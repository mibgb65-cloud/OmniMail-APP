package service

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"strings"
	"sync/atomic"
	"testing"

	"omnimail/desktop/internal/domain"
)

type authenticatedCleanupSession struct {
	fakeSession
	cancel context.CancelFunc
}

func (s authenticatedCleanupSession) Close() error {
	if s.cancel != nil {
		s.cancel()
	}
	return errors.New("PRIVATE_CLOSE_ERROR")
}

type authenticatedCleanupTransport struct {
	fakeTransport
	cancel          context.CancelFunc
	cancelAfterSMTP context.CancelFunc
	connects        atomic.Int32
	smtpChecks      atomic.Int32
}

func (f *authenticatedCleanupTransport) Connect(context.Context, domain.AccountEndpoint, []byte) (domain.MailSession, error) {
	if f.connects.Add(1) == 1 {
		return authenticatedCleanupSession{cancel: f.cancel}, nil
	}
	return fakeSession{}, nil
}

func (f *authenticatedCleanupTransport) CheckSMTP(ctx context.Context, endpoint domain.AccountEndpoint, secret []byte) error {
	f.smtpChecks.Add(1)
	if f.cancelAfterSMTP != nil {
		f.cancelAfterSMTP()
	}
	return f.fakeTransport.CheckSMTP(ctx, endpoint, secret)
}

// 将清理、SMTP、取消和保存断言放在同一生命周期中，确保成功不是跳过验证或泄漏凭据换来的。
func TestAuthenticatedIMAPCleanupDoesNotRejectAccount(t *testing.T) {
	for _, test := range []struct {
		name              string
		smtpErr           error
		canceled          bool
		canceledAfterSMTP bool
	}{
		{name: "smtp_succeeds"},
		{name: "smtp_rejects", smtpErr: domain.ErrAuthentication},
		{name: "request_canceled", canceled: true},
		{name: "canceled_after_smtp", canceledAfterSMTP: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			mail, store, secrets, _ := testService(t)
			var output bytes.Buffer
			mail.log = slog.New(slog.NewJSONHandler(&output, &slog.HandlerOptions{Level: slog.LevelWarn}))
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			transport := &authenticatedCleanupTransport{fakeTransport: fakeTransport{smtpError: test.smtpErr}}
			if test.canceled {
				transport.cancel = cancel
			}
			if test.canceledAfterSMTP {
				transport.cancelAfterSMTP = cancel
			}
			mail.transport = transport
			account, err := mail.AddAccount(ctx, addInput())
			want := test.smtpErr
			if test.canceled || test.canceledAfterSMTP {
				want = context.Canceled
			}
			if !errors.Is(err, want) {
				t.Fatalf("清理覆盖了认证结果：得到 %v，期望 %v", err, want)
			}
			wantChecks := int32(1)
			if test.canceled {
				wantChecks = 0
			}
			if transport.smtpChecks.Load() != wantChecks {
				t.Fatal("SMTP 验证未执行或取消后仍执行")
			}
			if err == nil {
				awaitSync(t, mail, account.ID)
			}
			accounts, err := store.ListAccounts(t.Context())
			wantAccounts, wantSecrets := 1, 2
			if want != nil {
				wantAccounts, wantSecrets = 0, 0
			}
			secrets.mu.Lock()
			secretCount := len(secrets.values)
			secrets.mu.Unlock()
			if err != nil || len(accounts) != wantAccounts || secretCount != wantSecrets {
				t.Fatal("账号/凭据保存不符合收发信验证结果")
			}
			if !strings.Contains(output.String(), "收信认证已通过，连接清理失败") {
				t.Fatal("认证后的清理失败未保留警告")
			}
			if strings.Contains(output.String(), "PRIVATE") {
				t.Fatal("清理日志泄漏了原始错误")
			}
		})
	}
}
