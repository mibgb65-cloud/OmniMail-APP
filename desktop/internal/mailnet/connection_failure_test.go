package mailnet

import (
	"context"
	"errors"
	"net"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"

	"github.com/emersion/go-imap/v2"
)

func assertConnectionFailure(t *testing.T, err, want error, stage, reason string) {
	t.Helper()
	if !errors.Is(err, want) || err.Error() != want.Error() {
		t.Fatal("连接错误未保留安全错误码")
	}
	var diagnostic interface {
		ConnectionStage() string
		DiagnosticCode() string
	}
	if !errors.As(err, &diagnostic) {
		t.Fatal("连接错误缺少阶段诊断")
	}
	if diagnostic.ConnectionStage() != stage || diagnostic.DiagnosticCode() != reason {
		t.Fatalf("连接诊断不匹配：stage=%s reason=%s", diagnostic.ConnectionStage(), diagnostic.DiagnosticCode())
	}
	// 不仅 Error()，整个错误链都不得保留服务器原文或连接中的账号数据。
	for cause := err; cause != nil; cause = errors.Unwrap(cause) {
		if strings.Contains(cause.Error(), "private") || strings.Contains(cause.Error(), "@") {
			t.Fatal("错误链包含私密诊断文本")
		}
	}
}

func TestConnectionFailureIncludesSafeAuthenticationStage(t *testing.T) {
	for _, protocol := range []string{"imap", "smtp"} {
		t.Run(protocol, func(t *testing.T) {
			endpoint, transport := authenticationFixture(t, protocol, "drop")
			var err error
			if protocol == "imap" {
				_, err = transport.Connect(t.Context(), endpoint, []byte("synthetic-password"))
			} else {
				err = transport.CheckSMTP(t.Context(), endpoint, []byte("synthetic-password"))
			}
			assertConnectionFailure(t, err, domain.ErrNetwork, "authenticate", "server_closed")
		})
	}
}

func TestConnectionFailureIncludesDialTLSAndCancellationStage(t *testing.T) {
	t.Run("dial", func(t *testing.T) {
		listener, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			t.Fatal("无法分配本地测试端口")
		}
		endpoint := testEndpoint(t, listener.Addr().String(), domain.TLSImplicit)
		if err := listener.Close(); err != nil {
			t.Fatal("无法关闭本地测试监听")
		}
		_, err = New().Connect(t.Context(), endpoint, []byte("synthetic-password"))
		assertConnectionFailure(t, err, domain.ErrNetwork, "dial", "connect_failed")
	})
	t.Run("tls", func(t *testing.T) {
		endpoint, _ := imapFixture(t, domain.TLSImplicit)
		_, err := New().Connect(t.Context(), endpoint, []byte("synthetic-password"))
		assertConnectionFailure(t, err, domain.ErrTLS, "tls", "certificate_rejected")
	})
	t.Run("canceled", func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		cancel()
		_, err := New().Connect(ctx, domain.AccountEndpoint{AuthKind: domain.AuthPassword}, nil)
		assertConnectionFailure(t, err, context.Canceled, "dial", "canceled")
	})
}

func TestConnectionFailureDiscardsPrivateCause(t *testing.T) {
	for _, test := range []struct {
		name, reason string
		cause        error
	}{
		{"unknown", "unknown", errors.New("private@example.invalid synthetic-password")},
		{"dns", "dns_failed", &net.DNSError{Err: "private error", Name: "private.example.invalid"}},
		{"response", "server_rejected", &imap.Error{
			Type: imap.StatusResponseTypeNo, Code: imap.ResponseCodeAuthenticationFailed,
			Text: "private@example.invalid synthetic-password",
		}},
	} {
		t.Run(test.name, func(t *testing.T) {
			err := connectionStepError("authenticate", domain.ErrNetwork, test.cause)
			assertConnectionFailure(t, err, domain.ErrNetwork, "authenticate", test.reason)
			if errors.Is(err, test.cause) {
				t.Fatal("诊断错误仍持有私密原始错误")
			}
		})
	}
}
