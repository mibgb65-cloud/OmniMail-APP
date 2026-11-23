package services

import (
	"context"
	"strings"
	"time"

	"omnimail/internal/accounts"
	"omnimail/internal/apperr"
	"omnimail/internal/events"
	"omnimail/internal/mailproto"
	"omnimail/internal/oauth"
)

func buildEndpointFromConnect(req accounts.ConnectRequest) mailproto.EndpointConfig {
	preset := mailproto.PresetByID(req.Provider)
	if req.Provider == "" {
		preset = mailproto.ResolveProviderByEmail(req.Email)
	}
	imapHost := strings.TrimSpace(req.ImapHost)
	if imapHost == "" {
		imapHost = preset.DefaultImapHost
	}
	imapPort := req.ImapPort
	if imapPort <= 0 {
		imapPort = preset.DefaultImapPort
	}
	imapSec := strings.TrimSpace(req.ImapSecurity)
	if imapSec == "" {
		imapSec = preset.DefaultImapSecurity
	}
	smtpHost := strings.TrimSpace(req.SmtpHost)
	if smtpHost == "" {
		smtpHost = preset.DefaultSmtpHost
	}
	smtpPort := req.SmtpPort
	if smtpPort <= 0 {
		smtpPort = preset.DefaultSmtpPort
	}
	smtpSec := strings.TrimSpace(req.SmtpSecurity)
	if smtpSec == "" {
		smtpSec = preset.DefaultSmtpSecurity
	}
	authMode := strings.TrimSpace(req.AuthMode)
	if authMode == "" {
		authMode = preset.AuthMode
	}
	return mailproto.EndpointConfig{
		Provider: preset.ID, Email: req.Email, Username: req.Username,
		AuthMode: authMode, Secret: req.Secret,
		ImapHost: imapHost, ImapPort: imapPort, ImapSecurity: imapSec,
		SmtpHost: smtpHost, SmtpPort: smtpPort, SmtpSecurity: smtpSec,
		CertFingerprint: req.CertFingerprint,
	}
}

func (s *AccountService) StartOAuthFlow(provider string) (oauth.FlowStartResult, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return oauth.FlowStartResult{}, err
	}
	settings, _ := s.mgr.GetAppSettings()
	customClientID := settings.OAuthGoogleClientID
	if provider == "outlook" {
		customClientID = settings.OAuthOutlookClientID
	}

	res, err := s.oauthMgr.StartFlow(provider, customClientID, func(done oauth.CompletedOAuth, flowErr error) {
		if flowErr != nil {
			if s.bus != nil {
				s.bus.Emit(events.AccountOAuthResult, events.AccountOAuthResultPayload{
					FlowID: done.FlowID, OK: false,
					ErrorCode: apperr.CodeOf(flowErr), ErrorMessage: flowErr.Error(),
				})
			}
			return
		}
		preset := mailproto.PresetByID(provider)
		email := strings.TrimSpace(done.Email)
		if email == "" {
			if s.bus != nil {
				s.bus.Emit(events.AccountOAuthResult, events.AccountOAuthResultPayload{
					FlowID: done.FlowID, OK: false,
					ErrorCode: apperr.CodeAuthExpired, ErrorMessage: "未能从 OAuth ID Token 解析出邮箱地址",
				})
			}
			return
		}
		probeCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		probe := mailproto.TestConnection(probeCtx, mailproto.EndpointConfig{
			Provider: provider, Email: email, AuthMode: "oauth", Secret: done.Token.AccessToken,
			ImapHost: preset.DefaultImapHost, ImapPort: preset.DefaultImapPort, ImapSecurity: preset.DefaultImapSecurity,
			SmtpHost: preset.DefaultSmtpHost, SmtpPort: preset.DefaultSmtpPort, SmtpSecurity: preset.DefaultSmtpSecurity,
		})
		cancel()
		if !probe.OK {
			if s.bus != nil {
				s.bus.Emit(events.AccountOAuthResult, events.AccountOAuthResultPayload{
					FlowID: done.FlowID, OK: false, ErrorCode: probe.ErrorCode, ErrorMessage: probe.Summary,
				})
			}
			return
		}
		created, createErr := accounts.Create(sess.DB, sess.Vault, accounts.ConnectRequest{
			Name: done.DisplayName, Email: email, Provider: provider,
			AuthMode: "oauth", SenderName: done.DisplayName, SkipProbe: true,
		})
		if createErr != nil {
			if s.bus != nil {
				s.bus.Emit(events.AccountOAuthResult, events.AccountOAuthResultPayload{
					FlowID: done.FlowID, OK: false, ErrorCode: apperr.CodeInternal, ErrorMessage: createErr.Error(),
				})
			}
			return
		}
		_ = oauth.SaveTokenToVault(sess.Vault, created.ID, done.Token)
		if s.syncer != nil {
			s.syncer.StartAccount(created.ID)
		}
		if s.bus != nil {
			s.bus.Emit(events.AccountOAuthResult, events.AccountOAuthResultPayload{
				FlowID: done.FlowID, OK: true, Account: created,
			})
		}
	})
	if err != nil {
		return oauth.FlowStartResult{}, err
	}
	if s.app != nil && res.AuthURL != "" {
		_ = s.app.Browser.OpenURL(res.AuthURL)
	}
	return res, nil
}

func (s *AccountService) CancelOAuthFlow(flowID string) error {
	return s.oauthMgr.CancelFlow(strings.TrimSpace(flowID))
}
