package mailnet

import (
	"context"
	"io"
	"log/slog"
	"strings"
	"sync"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
	"omnimail/desktop/internal/repository"
	"omnimail/desktop/internal/service"
)

type testSecrets struct {
	mu     sync.Mutex
	values map[string][]byte
}

func (s *testSecrets) Set(_ context.Context, id string, data []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.values[id] = append([]byte(nil), data...)
	return nil
}
func (s *testSecrets) Get(_ context.Context, id string) ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]byte(nil), s.values[id]...), nil
}
func (s *testSecrets) Delete(_ context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.values, id)
	return nil
}

func TestTLSAccountToDatabaseBodyAttachmentAndSend(t *testing.T) {
	raw := []byte("From: sender@example.invalid\r\nTo: person@example.invalid\r\nSubject: Integrated\r\n" +
		"MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=b\r\n\r\n" +
		"--b\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nhello\r\n" +
		"--b\r\nContent-Type: application/octet-stream\r\nContent-Disposition: attachment; filename=\"file.bin\"\r\n" +
		"Content-Transfer-Encoding: base64\r\n\r\naGVsbG8=\r\n--b--\r\n")
	imap, transport := imapFixture(t, domain.TLSImplicit, raw)
	smtp, _, delivered := smtpFixture(t, transport.roots)
	store, err := repository.Open(t.Context(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	manager := service.NewMail(store, &testSecrets{values: map[string][]byte{}}, transport, slog.New(slog.NewTextHandler(io.Discard, nil)))
	t.Cleanup(func() {
		if err := manager.Close(); err != nil {
			t.Error(err)
		}
		if err := store.Close(); err != nil {
			t.Error(err)
		}
	})
	server := func(endpoint domain.AccountEndpoint) service.ServerInput {
		return service.ServerInput{Host: endpoint.Host, Port: endpoint.Port, TLSMode: endpoint.TLSMode,
			Username: "test-user", Password: "test-password", AuthKind: domain.AuthPassword}
	}
	account, err := manager.AddAccount(t.Context(), service.AddAccountInput{ProviderCode: "custom",
		Email: "person@example.invalid", IMAP: server(imap), SMTP: server(smtp)})
	if err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(5 * time.Second)
	for {
		accounts, err := manager.Accounts(t.Context())
		if err != nil {
			t.Fatal(err)
		}
		if len(accounts) == 1 && !accounts[0].Sync.Running {
			if accounts[0].Sync.ErrorCode != "" {
				t.Fatal(accounts[0].Sync.ErrorCode)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("真实协议首次同步超时")
		}
		time.Sleep(time.Millisecond)
	}
	messages, err := manager.Messages(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(messages) != 1 {
		t.Fatalf("实际 FETCH 未落库：%v", err)
	}
	detail, err := manager.Message(t.Context(), messages[0].ID)
	if err != nil || strings.TrimSpace(detail.Body) != "hello" || len(detail.Attachments) != 1 {
		t.Fatalf("实际 MIME 未缓存：%v", err)
	}
	data, name, err := manager.Attachment(t.Context(), detail.Attachments[0].ID)
	if err != nil || string(data) != "hello" || name != "file.bin" {
		t.Fatalf("流式附件缓存不正确：%v", err)
	}
	if err := manager.Send(t.Context(), service.SendInput{AccountID: account.ID, To: "to@example.invalid", Subject: "outgoing", Body: "real smtp fixture"}); err != nil {
		t.Fatal(err)
	}
	select {
	case text := <-delivered:
		if !strings.Contains(text, "real smtp fixture") {
			t.Fatal("SMTP DATA 内容不正确")
		}
	case <-time.After(time.Second):
		t.Fatal("未投递至本地 SMTP")
	}
}
