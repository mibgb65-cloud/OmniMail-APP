package mailnet

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"errors"
	"io"
	"log"
	"math/big"
	"net"
	"strconv"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapserver"
	"github.com/emersion/go-imap/v2/imapserver/imapmemserver"
)

func testTLS(t *testing.T) (*tls.Config, *x509.CertPool) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	certificate := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "localhost"},
		NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour),
		KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		IPAddresses: []net.IP{net.ParseIP("127.0.0.1")}}
	der, err := x509.CreateCertificate(rand.Reader, certificate, certificate, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := x509.ParseCertificate(der)
	if err != nil {
		t.Fatal(err)
	}
	roots := x509.NewCertPool()
	roots.AddCert(parsed)
	return &tls.Config{Certificates: []tls.Certificate{{Certificate: [][]byte{der}, PrivateKey: key}}, MinVersion: tls.VersionTLS12}, roots
}

func testEndpoint(t *testing.T, address string, mode domain.TLSMode) domain.AccountEndpoint {
	t.Helper()
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		t.Fatal(err)
	}
	number, err := strconv.Atoi(port)
	if err != nil {
		t.Fatal(err)
	}
	return domain.AccountEndpoint{Host: host, Port: number, TLSMode: mode, Username: "test-user", AuthKind: domain.AuthPassword}
}

func imapFixture(t *testing.T, mode domain.TLSMode, rawMessage ...[]byte) (domain.AccountEndpoint, *Transport) {
	return imapFixtureWithCaps(t, mode, nil, rawMessage...)
}

func imapFixtureWithCaps(t *testing.T, mode domain.TLSMode, caps imap.CapSet, rawMessage ...[]byte) (domain.AccountEndpoint, *Transport) {
	t.Helper()
	config, roots := testTLS(t)
	memory := imapmemserver.New()
	user := imapmemserver.NewUser("test-user", "test-password")
	if err := user.Create("INBOX", nil); err != nil {
		t.Fatal(err)
	}
	raw := []byte("From: sender@example.invalid\r\nTo: person@example.invalid\r\nSubject: Test\r\nMessage-ID: <test@example.invalid>\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\nhello")
	if len(rawMessage) > 0 {
		raw = rawMessage[0]
	}
	if _, err := user.Append("INBOX", bytes.NewReader(raw), &imap.AppendOptions{Time: time.Now()}); err != nil {
		t.Fatal(err)
	}
	memory.AddUser(user)
	server := imapserver.New(&imapserver.Options{TLSConfig: config, Caps: caps, Logger: log.New(io.Discard, "", 0),
		NewSession: func(*imapserver.Conn) (imapserver.Session, *imapserver.GreetingData, error) {
			return memory.NewSession(), nil, nil
		}})
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	var serving net.Listener = listener
	if mode == domain.TLSImplicit {
		serving = tls.NewListener(listener, config)
	}
	done := make(chan error, 1)
	go func() { done <- server.Serve(serving) }()
	t.Cleanup(func() {
		if err := server.Close(); err != nil {
			t.Error(err)
		}
		if err := <-done; err != nil {
			t.Error(err)
		}
	})
	return testEndpoint(t, listener.Addr().String(), mode), &Transport{roots: roots}
}

func TestRealTLSIMAPAuthenticationAndFetch(t *testing.T) {
	for _, mode := range []domain.TLSMode{domain.TLSImplicit, domain.TLSStartTLS} {
		t.Run(string(mode), func(t *testing.T) {
			endpoint, transport := imapFixture(t, mode)
			session, err := transport.Connect(t.Context(), endpoint, []byte("test-password"))
			if err != nil {
				t.Fatal(err)
			}
			defer func() {
				if err := session.Close(); err != nil {
					t.Error(err)
				}
			}()
			boxes, err := session.Mailboxes()
			if err != nil || len(boxes) != 1 || boxes[0].Kind != "inbox" {
				t.Fatalf("LIST 失败：%v", err)
			}
			validity, next, err := session.Select("INBOX")
			if err != nil || validity == 0 || next != 2 {
				t.Fatalf("SELECT 失败：%v", err)
			}
			first, found, err := session.LocateUID(1)
			if err != nil || !found || first != 1 {
				t.Fatalf("UID SEARCH 失败：%v", err)
			}
			headers, err := session.Headers(1, 1)
			if err != nil || len(headers) != 1 || headers[0].Subject != "Test" {
				t.Fatalf("FETCH 失败：%v", err)
			}
			body, err := session.Body(1, nil)
			if err != nil || body.Text != "hello" {
				t.Fatalf("正文读取失败：%v", err)
			}
		})
	}
}

func TestAuthenticationTLSAndCancellationFailures(t *testing.T) {
	endpoint, transport := imapFixture(t, domain.TLSImplicit)
	if _, err := transport.Connect(t.Context(), endpoint, []byte("wrong")); !errors.Is(err, domain.ErrAuthentication) {
		t.Fatalf("认证错误未映射：%v", err)
	}
	if _, err := New().Connect(t.Context(), endpoint, []byte("test-password")); !errors.Is(err, domain.ErrTLS) {
		t.Fatalf("未拒绝不可信证书：%v", err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if _, err := transport.Connect(ctx, endpoint, []byte("test-password")); !errors.Is(err, context.Canceled) {
		t.Fatalf("取消错误丢失：%v", err)
	}
}
