package mailnet

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"sync/atomic"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
)

func TestConnectRecoversOnePreAuthenticationTLSDisconnect(t *testing.T) {
	backend, transport := imapFixture(t, domain.TLSImplicit)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal("无法创建断线测试代理")
	}
	var accepted atomic.Int32
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			if accepted.Add(1) == 1 {
				releaseConnection(conn)
				continue
			}
			upstream, err := net.DialTimeout("tcp", net.JoinHostPort(backend.Host, fmt.Sprint(backend.Port)), time.Second)
			if err != nil {
				releaseConnection(conn)
				return
			}
			copied := make(chan struct{})
			go func() {
				if _, err := io.Copy(upstream, conn); err != nil {
					t.Log("测试代理上行连接结束")
				}
				releaseConnection(upstream)
				close(copied)
			}()
			if _, err := io.Copy(conn, upstream); err != nil {
				t.Log("测试代理下行连接结束")
			}
			releaseConnection(conn)
			<-copied
			return
		}
	}()
	t.Cleanup(func() {
		if err := listener.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
			t.Error("断线测试监听清理失败")
		}
		select {
		case <-done:
		case <-time.After(3 * time.Second):
			t.Error("断线测试代理未退出")
		}
	})
	ctx, cancel := context.WithTimeout(t.Context(), 4*time.Second)
	defer cancel()
	value, err := transport.Connect(ctx, testEndpoint(t, listener.Addr().String(), domain.TLSImplicit), []byte("test-password"))
	if err != nil {
		t.Fatalf("首次 TLS 断线未有限恢复：%v", err)
	}
	if err := value.Close(); err != nil {
		t.Error("恢复后连接清理失败")
	}
	if accepted.Load() != 2 {
		t.Fatal("不是仅一次重试")
	}
}

func TestConnectionRetryPolicyRejectsSecurityAndPostAuthenticationFailures(t *testing.T) {
	for _, test := range []struct {
		stage, reason string
		want          bool
	}{
		{"tls", "server_closed", true},
		{"dial", "connect_failed", true},
		{"greeting", "server_closed", true},
		{"tls", "certificate_rejected", false},
		{"authenticate", "server_closed", false},
		{"identify", "server_closed", false},
		{"quit", "server_closed", false},
		{"tls", "unknown", false},
		{"dial", "canceled", false},
	} {
		t.Run(test.stage+"/"+test.reason, func(t *testing.T) {
			if canRetryConnection(&connectionFailure{code: domain.ErrNetwork, stage: test.stage, reason: test.reason}) != test.want {
				t.Fatal("连接重试越过安全/认证边界或未恢复瞬时断线")
			}
		})
	}
}

func TestCanceledConnectionDoesNotRetry(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	_, err := New().Connect(ctx, domain.AccountEndpoint{AuthKind: domain.AuthPassword}, []byte("synthetic"))
	if !errors.Is(err, context.Canceled) {
		t.Fatal("取消请求没有立即退出")
	}
}
