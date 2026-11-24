package services

import (
	"context"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

	"omnimail/internal/accounts"
	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/events"
	"omnimail/internal/mailproto"
	"omnimail/internal/oauth"
	"omnimail/internal/profilemgr"
	"omnimail/internal/syncer"
)

type SyncDriver interface {
	StartAccount(accountID string)
	StopAccount(accountID string)
	TriggerSync(accountID string) error
	LoadOlderMessages(ctx context.Context, accountID string, folder string, limit int) (syncer.LoadOlderResult, error)
}

type AccountService struct {
	mgr      *profilemgr.Manager
	bus      *events.Bus
	oauthMgr *oauth.Manager
	tokenMgr *oauth.TokenManager
	syncer   SyncDriver
	app      *application.App
}

func NewAccountService(mgr *profilemgr.Manager, bus *events.Bus, tm *oauth.TokenManager) *AccountService {
	if tm == nil {
		tm = oauth.NewTokenManager()
	}
	return &AccountService{
		mgr:      mgr,
		bus:      bus,
		oauthMgr: oauth.NewManager(),
		tokenMgr: tm,
	}
}

func AttachAccountRuntime(s *AccountService, app *application.App, driver SyncDriver) {
	if s == nil {
		return
	}
	if app != nil {
		s.app = app
	}
	if driver != nil {
		s.syncer = driver
	}
}

func (s *AccountService) ListProviderPresets() ([]mailproto.ProviderPreset, error) {
	return mailproto.ListProviderPresets(), nil
}

func (s *AccountService) ResolveProviderByEmail(email string) (mailproto.ProviderPreset, error) {
	return mailproto.ResolveProviderByEmail(email), nil
}

func (s *AccountService) TestConnection(req accounts.ConnectRequest) (mailproto.ConnectionTestReport, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return mailproto.ConnectionTestReport{}, err
	}
	cfg := buildEndpointFromConnect(req)
	if strings.TrimSpace(cfg.Secret) == "" && req.ID != "" && sess.Vault != nil {
		if saved, ok := sess.Vault.Get(accounts.VaultImapPassKey(req.ID)); ok {
			cfg.Secret = saved
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 35*time.Second)
	defer cancel()
	return mailproto.TestConnection(ctx, cfg), nil
}

func (s *AccountService) AddAccount(req accounts.ConnectRequest) (accounts.EmailAccountDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return accounts.EmailAccountDTO{}, err
	}
	if !req.SkipProbe {
		ctx, cancel := context.WithTimeout(context.Background(), 35*time.Second)
		report := mailproto.TestConnection(ctx, buildEndpointFromConnect(req))
		cancel()
		if !report.OK {
			code := report.ErrorCode
			if code == "" {
				code = apperr.CodeConnFailed
			}
			return accounts.EmailAccountDTO{}, apperr.New(code, report.Summary)
		}
	}
	created, err := accounts.Create(sess.DB, sess.Vault, req)
	if err != nil {
		return accounts.EmailAccountDTO{}, err
	}
	if created.IsDefault {
		id := created.ID
		_, _ = s.mgr.UpdateAppSettings(config.AppSettingsPatch{DefaultSendAccountID: &id})
	}
	if s.syncer != nil {
		s.syncer.StartAccount(created.ID)
	}
	return created, nil
}

func (s *AccountService) ListAccounts() ([]accounts.EmailAccountDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return nil, err
	}
	return accounts.List(sess.DB, sess.Vault)
}

func (s *AccountService) UpdateAccount(req accounts.UpdateRequest) (accounts.EmailAccountDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return accounts.EmailAccountDTO{}, err
	}
	updated, err := accounts.Update(sess.DB, sess.Vault, req)
	if err != nil {
		return accounts.EmailAccountDTO{}, err
	}
	if (req.Imap != nil || req.Smtp != nil || req.Secret != "") && s.syncer != nil {
		s.syncer.StopAccount(updated.ID)
		s.syncer.StartAccount(updated.ID)
	}
	return updated, nil
}

func (s *AccountService) SetDefaultAccount(accountID string) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return err
	}
	id := strings.TrimSpace(accountID)
	if err := accounts.SetDefault(sess.DB, id); err != nil {
		return err
	}
	_, _ = s.mgr.UpdateAppSettings(config.AppSettingsPatch{DefaultSendAccountID: &id})
	return nil
}

func (s *AccountService) RemoveAccount(accountID string) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return err
	}
	id := strings.TrimSpace(accountID)
	if s.syncer != nil {
		s.syncer.StopAccount(id)
	}
	if err := accounts.Remove(sess.DB, sess.Vault, id); err != nil {
		return err
	}
	go func() {
		_, _ = sess.Blobs.CleanOrphanBlobs(sess.DB)
	}()
	return nil
}

func (s *AccountService) TriggerSync(accountID string) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return err
	}
	if s.syncer != nil {
		return s.syncer.TriggerSync(strings.TrimSpace(accountID))
	}
	list, _ := accounts.List(sess.DB, sess.Vault)
	now := time.Now().UnixMilli()
	for _, acc := range list {
		if accountID == "" || acc.ID == accountID {
			accounts.UpdateStatus(sess.DB, acc.ID, "connected", "", now)
			if s.bus != nil {
				s.bus.Emit(events.AccountStatus, events.AccountStatusPayload{
					AccountID: acc.ID, Status: "connected", LastSyncedAt: now,
				})
			}
		}
	}
	return nil
}
