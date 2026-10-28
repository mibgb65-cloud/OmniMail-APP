package service

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
	"omnimail/desktop/internal/repository"
)

type memorySecrets struct {
	mu     sync.Mutex
	values map[string][]byte
	sets   int
	failAt int
}

func (s *memorySecrets) Set(_ context.Context, ref string, data []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sets++
	if s.sets == s.failAt {
		return domain.ErrCredentialUnavailable
	}
	s.values[ref] = append([]byte(nil), data...)
	return nil
}
func (s *memorySecrets) Get(_ context.Context, ref string) ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, ok := s.values[ref]
	if !ok {
		return nil, domain.ErrCredentialMissing
	}
	return append([]byte(nil), data...), nil
}
func (s *memorySecrets) Delete(_ context.Context, ref string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.values, ref)
	return nil
}

type fakeTransport struct {
	authError error
	smtpError error
}

func (f *fakeTransport) Connect(context.Context, domain.AccountEndpoint, []byte) (domain.MailSession, error) {
	if f.authError != nil {
		return nil, f.authError
	}
	return fakeSession{}, nil
}
func (f *fakeTransport) CheckSMTP(context.Context, domain.AccountEndpoint, []byte) error {
	return f.smtpError
}
func (f *fakeTransport) Send(context.Context, domain.AccountEndpoint, []byte, string, []string, []byte) error {
	return f.smtpError
}

type fakeSession struct{}

func (fakeSession) LocateUID(from uint32) (uint32, bool, error) { return 1, from <= 1, nil }

func (fakeSession) Mailboxes() ([]domain.RemoteMailbox, error) {
	return []domain.RemoteMailbox{{Name: "INBOX", Kind: "inbox"}}, nil
}
func (fakeSession) Select(string) (uint32, uint32, error) { return 7, 2, nil }
func (fakeSession) Headers(start, end uint32) ([]domain.RemoteMessage, error) {
	if start > 1 || end < 1 {
		return nil, nil
	}
	return []domain.RemoteMessage{{UID: 1, Subject: "actual cached fixture", ReceivedAt: 1}}, nil
}
func (fakeSession) Body(uint32, domain.AttachmentSink) (domain.DecodedMail, error) {
	return domain.DecodedMail{Text: "decoded fixture"}, nil
}
func (fakeSession) Close() error { return nil }

func testService(t *testing.T) (*Mail, *repository.Store, *memorySecrets, *fakeTransport) {
	t.Helper()
	store, err := repository.Open(t.Context(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	secrets := &memorySecrets{values: map[string][]byte{}}
	transport := new(fakeTransport)
	mail := NewMail(store, secrets, transport, slog.New(slog.NewTextHandler(io.Discard, nil)))
	t.Cleanup(func() {
		if err := mail.Close(); err != nil {
			t.Error(err)
		}
		if err := store.Close(); err != nil {
			t.Error(err)
		}
	})
	return mail, store, secrets, transport
}
func addInput() AddAccountInput {
	server := ServerInput{Host: "mail.example.invalid", Port: 993, TLSMode: domain.TLSImplicit, Username: "person", Password: "application-code", AuthKind: domain.AuthPassword}
	return AddAccountInput{ProviderCode: "custom", Email: "person@example.invalid", DisplayName: "工作", IMAP: server, SMTP: server}
}
func awaitSync(t *testing.T, mail *Mail, id string) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		mail.mu.Lock()
		active := mail.active[id]
		mail.mu.Unlock()
		if !active {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("同步未在期限内完成")
}

func TestAccountAuthenticationSyncBodySendAndDisconnect(t *testing.T) {
	mail, store, secrets, _ := testService(t)
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	list, err := mail.Messages(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(list) != 1 {
		t.Fatalf("首次同步失败：%v", err)
	}
	detail, err := mail.Message(t.Context(), list[0].ID)
	if err != nil || detail.Body != "decoded fixture" || !detail.Cached {
		t.Fatalf("正文未缓存：%v", err)
	}
	detail, err = mail.Message(t.Context(), list[0].ID)
	if err != nil || !detail.Cached {
		t.Fatal("离线缓存未复用")
	}
	if err := mail.Send(t.Context(), SendInput{AccountID: account.ID, To: "to@example.invalid", Subject: "主题", Body: "正文"}); err != nil {
		t.Fatal(err)
	}
	if err := mail.Disconnect(t.Context(), account.ID); err != nil {
		t.Fatal(err)
	}
	saved, err := store.GetAccount(t.Context(), account.ID)
	if err != nil || saved.Status != domain.AccountDisconnected {
		t.Fatal("断开未保存")
	}
	secrets.mu.Lock()
	count := len(secrets.values)
	secrets.mu.Unlock()
	if count != 0 {
		t.Fatal("断开遗留凭据")
	}
	accounts, err := mail.Accounts(t.Context())
	if err != nil || len(accounts) != 1 {
		t.Fatal("断开后配置丢失")
	}
}

func TestFailedAuthenticationOrCredentialsDoesNotSave(t *testing.T) {
	for _, failure := range []string{"imap", "smtp", "secret"} {
		t.Run(failure, func(t *testing.T) {
			mail, store, secrets, transport := testService(t)
			switch failure {
			case "imap":
				transport.authError = domain.ErrAuthentication
			case "smtp":
				transport.smtpError = domain.ErrAuthentication
			case "secret":
				secrets.failAt = 2
			}
			if _, err := mail.AddAccount(t.Context(), addInput()); err == nil {
				t.Fatal("失败仍然成功")
			}
			accounts, err := store.ListAccounts(t.Context())
			if err != nil || len(accounts) != 0 {
				t.Fatal("失败遗留账号")
			}
			secrets.mu.Lock()
			count := len(secrets.values)
			secrets.mu.Unlock()
			if count != 0 {
				t.Fatal("失败未补偿凭据")
			}
		})
	}
}

type failingCreate struct{ domain.MailRepository }

func (f failingCreate) CreateAccount(context.Context, domain.Account) (domain.Account, error) {
	return domain.Account{}, errors.New("database failed")
}
func TestDatabaseFailureCompensatesCredentials(t *testing.T) {
	mail, store, secrets, _ := testService(t)
	mail.store = failingCreate{store}
	if _, err := mail.AddAccount(t.Context(), addInput()); err == nil {
		t.Fatal("DB 失败仍成功")
	}
	if len(secrets.values) != 0 {
		t.Fatal("DB 失败遗留秘密")
	}
}

func TestInputErrorMappingAndShutdown(t *testing.T) {
	mail, _, _, _ := testService(t)
	input := addInput()
	input.IMAP.Port = 0
	if _, err := mail.AddAccount(t.Context(), input); !errors.Is(err, domain.ErrInvalidAccount) {
		t.Fatal("端口校验失效")
	}
	input = addInput()
	input.IMAP.AuthKind = domain.AuthOAuth2
	if _, err := mail.AddAccount(t.Context(), input); !errors.Is(err, domain.ErrOAuthConfig) {
		t.Fatal("OAuth 缺配置未明确返回")
	}
	for _, known := range []error{domain.ErrAuthentication, domain.ErrTLS, domain.ErrNetwork, domain.ErrProtocol,
		domain.ErrTooLarge, domain.ErrOAuthConfig, domain.ErrCredentialMissing, domain.ErrCredentialUnavailable,
		domain.ErrCredentialInvalid, domain.ErrSendUncertain} {
		if ErrorCode(known) != known.Error() {
			t.Fatal("稳定错误码不匹配")
		}
	}
	if ErrorCode(errors.New("sensitive-diagnostic")) != "STORAGE_FAILED" {
		t.Fatal("未知错误未脱敏")
	}
	if ErrorCode(domain.ErrAuthentication) != "AUTH_INVALID" || ErrorCode(domain.ErrSendUncertain) != "SEND_UNCERTAIN" || ErrorCode(context.Canceled) != "CANCELED" {
		t.Fatal("错误映射错误")
	}
	mail.Start()
	if err := mail.Close(); err != nil {
		t.Fatal(err)
	}
	if err := mail.QueueSync("missing"); err == nil {
		t.Fatal("关闭后仍接收同步")
	}
	if _, err := mail.AddAccount(t.Context(), addInput()); !errors.Is(err, context.Canceled) {
		t.Fatal("关闭后仍接收账号")
	}
}

type sparseSession struct{ fakeSession }

func (sparseSession) LocateUID(from uint32) (uint32, bool, error) {
	return 1999999, from <= 1999999, nil
}
func (sparseSession) Select(string) (uint32, uint32, error) { return 7, 2000000, nil }
func (sparseSession) Headers(start, end uint32) ([]domain.RemoteMessage, error) {
	if start <= 1999999 && end >= 1999999 {
		return []domain.RemoteMessage{{UID: 1999999, Subject: "sparse", ReceivedAt: 1}}, nil
	}
	return nil, nil
}

type sparseTransport struct{ fakeTransport }

func (*sparseTransport) Connect(context.Context, domain.AccountEndpoint, []byte) (domain.MailSession, error) {
	return sparseSession{}, nil
}
func TestInitialSyncDoesNotWalkMillionsOfEmptyUIDs(t *testing.T) {
	mail, _, _, _ := testService(t)
	mail.transport = &sparseTransport{}
	account, err := mail.AddAccount(t.Context(), addInput())
	if err != nil {
		t.Fatal(err)
	}
	awaitSync(t, mail, account.ID)
	messages, err := mail.Messages(t.Context(), account.ID, "inbox", 0)
	if err != nil || len(messages) != 1 || messages[0].Subject != "sparse" {
		t.Fatal("首次同步没有跳过空 UID 区间")
	}
}
