package service

import (
	"context"
	"crypto/rand"
	"errors"
	"log/slog"
	"strings"
	"sync"
	"time"
	"unicode"

	"omnimail/desktop/internal/domain"
)

type ServerInput struct {
	Host     string          `json:"host"`
	Port     int             `json:"port"`
	TLSMode  domain.TLSMode  `json:"tlsMode"`
	Username string          `json:"username"`
	Password string          `json:"password"`
	AuthKind domain.AuthKind `json:"authKind"`
}
type AddAccountInput struct {
	ProviderCode string      `json:"providerCode"`
	Email        string      `json:"email"`
	DisplayName  string      `json:"displayName"`
	IMAP         ServerInput `json:"imap"`
	SMTP         ServerInput `json:"smtp"`
}
type AccountSummary struct {
	ID           string               `json:"id"`
	Email        string               `json:"email"`
	DisplayName  string               `json:"displayName"`
	ProviderCode string               `json:"providerCode"`
	Status       domain.AccountStatus `json:"status"`
	Sync         SyncState            `json:"sync"`
}
type SyncState struct {
	Running    bool   `json:"running"`
	More       bool   `json:"more"`
	ErrorCode  string `json:"errorCode"`
	LastSyncAt int64  `json:"lastSyncAt"`
}
type Mail struct {
	store       domain.MailRepository
	secrets     domain.CredentialStore
	transport   domain.MailTransport
	log         *slog.Logger
	ctx         context.Context
	cancel      context.CancelFunc
	mu          sync.Mutex
	closed      bool
	started     bool
	active      map[string]bool
	states      map[string]SyncState
	pending     map[string]bool
	cycles      map[string]map[string]bool
	wg          sync.WaitGroup
	network     chan struct{}
	bodyNetwork chan struct{}
	flagNetwork chan struct{}
	foreground  map[string]*foregroundLanes
	revoking    map[string]bool
	flagCommit  sync.Mutex
	flagEpoch   map[string]uint64
	actions     sync.Mutex
}

func NewMail(store domain.MailRepository, secrets domain.CredentialStore, transport domain.MailTransport, log *slog.Logger) *Mail {
	ctx, cancel := context.WithCancel(context.Background())
	return &Mail{store: store, secrets: secrets, transport: transport, log: log, ctx: ctx, cancel: cancel,
		active: map[string]bool{}, states: map[string]SyncState{}, pending: map[string]bool{},
		cycles: map[string]map[string]bool{}, network: make(chan struct{}, 3),
		bodyNetwork: make(chan struct{}, 3), flagNetwork: make(chan struct{}, 2),
		foreground: map[string]*foregroundLanes{}, revoking: map[string]bool{}, flagEpoch: map[string]uint64{}}
}

func (s *Mail) Accounts(ctx context.Context) ([]AccountSummary, error) {
	accounts, err := s.store.ListAccounts(ctx)
	if err != nil {
		return nil, err
	}
	result := []AccountSummary{}
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, account := range accounts {
		result = append(result, AccountSummary{account.ID, account.Email, account.DisplayName, account.ProviderCode, account.Status, s.states[account.ID]})
	}
	return result, nil
}

func accountFromInput(input AddAccountInput) (domain.Account, error) {
	id := rand.Text()
	now := time.Now().UnixMilli()
	account := domain.Account{ID: id, ProviderCode: input.ProviderCode, Email: input.Email, DisplayName: input.DisplayName,
		Status: domain.AccountConfigured, SyncEnabled: true, CreatedAt: now, UpdatedAt: now}
	for i, server := range []ServerInput{input.IMAP, input.SMTP} {
		if server.AuthKind != domain.AuthPassword {
			if server.AuthKind == domain.AuthOAuth2 {
				return account, domain.ErrOAuthConfig
			}
			return account, domain.ErrInvalidAccount
		}
		if len(server.Password) == 0 || len(server.Password) > 1024 || strings.ContainsFunc(server.Password, unicode.IsControl) {
			return account, domain.ErrCredentialInvalid
		}
		protocol := domain.ProtocolIMAP
		if i == 1 {
			protocol = domain.ProtocolSMTP
		}
		account.Endpoints = append(account.Endpoints, domain.AccountEndpoint{
			ID: rand.Text(), Protocol: protocol, Host: server.Host, Port: server.Port, TLSMode: server.TLSMode,
			Username: server.Username, AuthKind: server.AuthKind, CredentialRef: "omnimail/account/" + id + "/" + string(protocol),
			CreatedAt: now, UpdatedAt: now})
	}
	return account, account.Validate()
}

func (s *Mail) AddAccount(ctx context.Context, input AddAccountInput) (AccountSummary, error) {
	if !s.actions.TryLock() {
		return AccountSummary{}, errors.New("BUSY")
	}
	defer s.actions.Unlock()
	ctx, done, err := s.request(ctx)
	if err != nil {
		return AccountSummary{}, err
	}
	defer done()
	account, err := accountFromInput(input)
	if err != nil {
		return AccountSummary{}, err
	}
	if err := s.acquire(ctx); err != nil {
		return AccountSummary{}, err
	}
	defer func() { <-s.network }()
	session, err := s.transport.Connect(ctx, account.Endpoints[0], []byte(input.IMAP.Password))
	if err != nil {
		return AccountSummary{}, err
	}
	if err := session.Close(); err != nil {
		return AccountSummary{}, domain.ErrNetwork
	}
	if err := s.transport.CheckSMTP(ctx, account.Endpoints[1], []byte(input.SMTP.Password)); err != nil {
		return AccountSummary{}, err
	}
	// 两种认证全部成功后才写 OS 和 DB；每次使用新引用，不覆盖任何已保存账号的秘密。
	saved := []string{}
	for i, password := range []string{input.IMAP.Password, input.SMTP.Password} {
		ref := account.Endpoints[i].CredentialRef
		saved = append(saved, ref)
		if err := s.secrets.Set(ctx, ref, []byte(password)); err != nil {
			return AccountSummary{}, s.compensate(saved, err)
		}
	}
	created, err := s.store.CreateAccount(ctx, account)
	if err != nil {
		// 提交时连接/上下文失败可能留下不确定结果，先读回再决定是否回收新凭据。
		check, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		persisted, lookupError := s.store.GetAccount(check, account.ID)
		if lookupError == nil {
			created = persisted
		} else if !errors.Is(lookupError, domain.ErrAccountNotFound) {
			return AccountSummary{}, errors.Join(err, domain.ErrCredentialCleanup)
		} else {
			return AccountSummary{}, s.compensate(saved, err)
		}
	}
	account = created
	summary := AccountSummary{ID: account.ID, Email: account.Email, DisplayName: account.DisplayName,
		ProviderCode: account.ProviderCode, Status: account.Status}
	if err := s.QueueSync(account.ID); err != nil {
		summary.Sync.ErrorCode = ErrorCode(err)
	}
	return summary, nil
}

func (s *Mail) compensate(references []string, cause error) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for _, reference := range references {
		if err := s.secrets.Delete(ctx, reference); err != nil {
			s.log.Warn("账号保存失败后的凭据清理未完成", "code", "CREDENTIAL_CLEANUP_FAILED")
			cause = errors.Join(cause, domain.ErrCredentialCleanup)
		}
	}
	return cause
}

func (s *Mail) acquire(ctx context.Context) error {
	select {
	case s.network <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	case <-s.ctx.Done():
		return context.Canceled
	}
}

func endpoint(account domain.Account, protocol domain.Protocol) (domain.AccountEndpoint, error) {
	for _, endpoint := range account.Endpoints {
		if endpoint.Protocol == protocol {
			return endpoint, nil
		}
	}
	return domain.AccountEndpoint{}, domain.ErrInvalidAccount
}

func (s *Mail) Disconnect(ctx context.Context, id string) error {
	if !s.actions.TryLock() {
		return errors.New("BUSY")
	}
	defer s.actions.Unlock()
	ctx, done, err := s.request(ctx)
	if err != nil {
		return err
	}
	defer done()
	release, err := s.claimRevocation(id)
	if err != nil {
		return err
	}
	defer release()
	refs, err := s.store.DisconnectAccount(ctx, id)
	if err != nil {
		return err
	}
	s.mu.Lock()
	delete(s.cycles, id)
	s.mu.Unlock()
	return s.compensate(refs, nil)
}

func (s *Mail) request(parent context.Context) (context.Context, func(), error) {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return nil, nil, context.Canceled
	}
	s.wg.Add(1)
	s.mu.Unlock()
	ctx, cancel := context.WithTimeout(parent, 60*time.Second)
	stop := context.AfterFunc(s.ctx, cancel)
	return ctx, func() { stop(); cancel(); s.wg.Done() }, nil
}

func (s *Mail) claim(id string) (func(), error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil, context.Canceled
	}
	if s.active[id] {
		return nil, errors.New("BUSY")
	}
	s.active[id] = true
	return func() { s.mu.Lock(); delete(s.active, id); s.mu.Unlock() }, nil
}
