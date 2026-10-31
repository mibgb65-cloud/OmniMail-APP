package mailnet

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"io"
	"net"
	"net/textproto"
	"strings"
	"sync"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
)

func smtpFixture(t *testing.T, sharedRoots ...*x509.CertPool) (domain.AccountEndpoint, *Transport, <-chan string) {
	t.Helper()
	config, roots := testTLS(t)
	if len(sharedRoots) > 0 {
		cert, err := x509.ParseCertificate(config.Certificates[0].Certificate[0])
		if err != nil {
			t.Fatal(err)
		}
		sharedRoots[0].AddCert(cert)
	}
	listener, err := tls.Listen("tcp", "127.0.0.1:0", config)
	if err != nil {
		t.Fatal(err)
	}
	messages := make(chan string, 4)
	var workers sync.WaitGroup
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			conn, err := listener.Accept()
			if errors.Is(err, net.ErrClosed) {
				return
			}
			if err != nil {
				t.Error("测试 SMTP accept 失败")
				return
			}
			workers.Add(1)
			go func() { defer workers.Done(); serveSMTP(t, conn, messages) }()
		}
	}()
	t.Cleanup(func() {
		if err := listener.Close(); err != nil {
			t.Error(err)
		}
		<-done
		workers.Wait()
	})
	return testEndpoint(t, listener.Addr().String(), domain.TLSImplicit), &Transport{roots: roots}, messages
}

// 测试夹具将 AUTH/MAIL/DATA 的顺序放在同一状态机，便于审阅测试没有绕过认证；不是生产 SMTP 服务。
func serveSMTP(t *testing.T, conn net.Conn, messages chan<- string) {
	defer func() {
		if err := conn.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
			t.Error("测试连接关闭失败")
		}
	}()
	if err := conn.SetDeadline(time.Now().Add(10 * time.Second)); err != nil {
		t.Error(err)
		return
	}
	protocol := textproto.NewConn(conn)
	write := func(format string, args ...interface{}) bool {
		if err := protocol.PrintfLine(format, args...); err != nil {
			t.Error("测试 SMTP 响应失败")
			return false
		}
		return true
	}
	if !write("220 localhost ESMTP") {
		return
	}
	authenticated := false
	for {
		line, err := protocol.ReadLine()
		if errors.Is(err, io.EOF) {
			return
		}
		if err != nil {
			return
		}
		switch {
		case strings.HasPrefix(line, "EHLO"):
			if !write("250-localhost\r\n250 AUTH PLAIN") {
				return
			}
		case strings.HasPrefix(line, "AUTH PLAIN "):
			data, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(line, "AUTH PLAIN "))
			authenticated = err == nil && string(data) == "\x00test-user\x00test-password"
			if authenticated {
				if !write("235 authenticated") {
					return
				}
			} else {
				if !write("535 authentication failed") {
					return
				}
			}
		case line == "QUIT":
			write("221 goodbye")
			return
		case !authenticated:
			if !write("530 authenticate first") {
				return
			}
		case line == "DATA":
			if !write("354 continue") {
				return
			}
			data, err := protocol.ReadDotBytes()
			if err != nil {
				t.Error(err)
				return
			}
			messages <- string(data)
			if !write("250 accepted") {
				return
			}
		default:
			if !write("250 ok") {
				return
			}
		}
	}
}

func TestRealTLSMTPAuthenticationAndSend(t *testing.T) {
	endpoint, transport, messages := smtpFixture(t)
	if err := transport.CheckSMTP(t.Context(), endpoint, []byte("test-password")); err != nil {
		t.Fatal(err)
	}
	if err := transport.CheckSMTP(t.Context(), endpoint, []byte("wrong")); !errors.Is(err, domain.ErrAuthentication) {
		t.Fatalf("SMTP 错误未映射：%v", err)
	}
	data := []byte("From: sender@example.invalid\r\nTo: recipient@example.invalid\r\nSubject: test\r\n\r\nhello\r\n")
	if err := transport.Send(t.Context(), endpoint, []byte("test-password"), "sender@example.invalid", []string{"recipient@example.invalid"}, data); err != nil {
		t.Fatal(err)
	}
	select {
	case got := <-messages:
		if !strings.Contains(got, "hello") {
			t.Fatal("未接收到 DATA")
		}
	case <-time.After(time.Second):
		t.Fatal("未收到发送内容")
	}
}
