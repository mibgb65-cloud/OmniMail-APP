package mailnet

import (
	"bufio"
	"context"
	"crypto/tls"
	"errors"
	"io"
	"net"
	"strings"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
)

// 用本地 TLS 重放认证阶段的合成响应；不打印客户端命令或原始服务器文本。
// 握手、响应脚本和有界清理集中在同一夹具中，便于核对每种失败的完整连接生命周期。
func authenticationFixture(t *testing.T, protocol, response string) (domain.AccountEndpoint, *Transport) {
	t.Helper()
	config, roots := testTLS(t)
	listener, err := tls.Listen("tcp", "127.0.0.1:0", config)
	if err != nil {
		t.Fatal("无法启动本地认证测试服务器")
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		defer releaseConnection(conn)
		if err := conn.SetDeadline(time.Now().Add(3 * time.Second)); err != nil {
			t.Error("认证测试连接无法设置期限")
			return
		}
		write := func(text string) bool {
			_, err := io.WriteString(conn, text+"\r\n")
			return err == nil
		}
		greeting := "* OK [CAPABILITY IMAP4rev1] local fixture"
		if protocol == "smtp" {
			greeting = "220 localhost ESMTP"
		}
		if !write(greeting) {
			return
		}
		reader := bufio.NewReader(conn)
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				return
			}
			fields := strings.Fields(line)
			if len(fields) < 2 {
				return
			}
			switch {
			case protocol == "imap" && fields[1] == "CAPABILITY":
				if !write("* CAPABILITY IMAP4rev1\r\n" + fields[0] + " OK capabilities") {
					return
				}
			case protocol == "imap" && fields[1] == "LOGIN":
				if response != "drop" {
					write(fields[0] + " " + response + " private-server-marker")
				}
				return
			case protocol == "smtp" && fields[0] == "EHLO":
				if !write("250-localhost\r\n250 AUTH PLAIN") {
					return
				}
			case protocol == "smtp" && fields[0] == "AUTH":
				if response == "drop" {
					return
				}
				value := response
				if response == "authenticated_drop" {
					value = "235 2.7.0"
				}
				if !write(value + " private-server-marker") {
					return
				}
			case protocol == "smtp" && fields[0] == "QUIT":
				if response != "authenticated_drop" {
					write("221 goodbye")
				}
				return
			default:
				t.Error("认证测试收到非预期协议命令")
				return
			}
		}
	}()
	t.Cleanup(func() {
		if err := listener.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
			t.Error("认证测试监听清理失败")
		}
		select {
		case <-done:
		case <-time.After(4 * time.Second):
			t.Error("认证测试连接未退出")
		}
	})
	endpoint := testEndpoint(t, listener.Addr().String(), domain.TLSImplicit)
	return endpoint, &Transport{roots: roots}
}

func TestIMAPLoginFailureClassification(t *testing.T) {
	for _, test := range []struct {
		response string
		want     error
	}{
		{"NO [ALERT]", domain.ErrAuthentication},
		{"NO [AUTHENTICATIONFAILED]", domain.ErrAuthentication},
		{"NO [AUTHORIZATIONFAILED]", domain.ErrAuthentication},
		{"NO [EXPIRED]", domain.ErrAuthentication},
		{"NO [CONTACTADMIN]", domain.ErrAuthentication},
		{"NO", domain.ErrAuthentication},
		{"NO [UNAVAILABLE]", domain.ErrNetwork},
		{"NO [PRIVACYREQUIRED]", domain.ErrTLS},
		{"NO [SERVERBUG]", domain.ErrProtocol},
		{"NO [UNKNOWN]", domain.ErrProtocol},
		{"BAD", domain.ErrProtocol},
		{"BAD [AUTHENTICATIONFAILED]", domain.ErrProtocol},
		{"drop", domain.ErrNetwork},
	} {
		t.Run(test.response, func(t *testing.T) {
			endpoint, transport := authenticationFixture(t, "imap", test.response)
			value, err := transport.Connect(t.Context(), endpoint, []byte("synthetic-password"))
			if value != nil {
				if closeErr := value.Close(); closeErr != nil {
					t.Error("认证失败会话清理失败")
				}
				t.Fatal("认证失败仍返回会话")
			}
			if !errors.Is(err, test.want) {
				t.Fatalf("分类错误：得到 %v，期望 %v", err, test.want)
			}
			if err.Error() != test.want.Error() {
				t.Fatal("认证错误暴露了原始响应")
			}
		})
	}
}

func TestSMTPAuthFailureClassification(t *testing.T) {
	for _, test := range []struct {
		response string
		want     error
	}{
		{"534 5.7.9", domain.ErrAuthentication},
		{"535 5.7.8", domain.ErrAuthentication},
		{"454 4.7.0", domain.ErrNetwork},
		{"538 5.7.11", domain.ErrTLS},
		{"504 5.5.4", domain.ErrProtocol},
		{"drop", domain.ErrNetwork},
	} {
		t.Run(test.response, func(t *testing.T) {
			endpoint, transport := authenticationFixture(t, "smtp", test.response)
			err := transport.CheckSMTP(t.Context(), endpoint, []byte("synthetic-password"))
			if !errors.Is(err, test.want) {
				t.Fatalf("分类错误：得到 %v，期望 %v", err, test.want)
			}
			if err.Error() != test.want.Error() {
				t.Fatal("认证错误暴露了原始响应")
			}
		})
	}
}

func TestAuthenticationCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	endpoint := domain.AccountEndpoint{AuthKind: domain.AuthPassword}
	if err := New().CheckSMTP(ctx, endpoint, []byte("synthetic-password")); !errors.Is(err, context.Canceled) {
		t.Fatal("SMTP 认证丢失取消状态")
	}
}

func TestSMTPVerificationKeepsSuccessfulAuthenticationAfterQuitFailure(t *testing.T) {
	endpoint, transport := authenticationFixture(t, "smtp", "authenticated_drop")
	if err := transport.CheckSMTP(t.Context(), endpoint, []byte("synthetic-password")); err != nil {
		t.Fatalf("认证后的 QUIT 断线不应推翻验证成功：%v", err)
	}
}
