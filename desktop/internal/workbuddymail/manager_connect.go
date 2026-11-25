package workbuddymail

import (
	"context"
	"strings"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/profilemgr"
)

func (m *Manager) PollAuthStatus(sess *profilemgr.Session, flowID string) (AuthPollResult, error) {
	m.mu.Lock()
	rt := m.ensureRuntimeLocked(sess)
	flow := rt.flow
	m.mu.Unlock()

	if flow == nil || (strings.TrimSpace(flowID) != "" && flow.flowID != strings.TrimSpace(flowID)) {
		return AuthPollResult{Stage: AuthStageIdle}, nil
	}
	flow.mu.Lock()
	res := flow.pollResult
	res.Aliases = append([]Alias(nil), flow.pollResult.Aliases...)
	flow.mu.Unlock()
	return res, nil
}

func (m *Manager) CancelAuth(sess *profilemgr.Session, flowID string) error {
	m.mu.Lock()
	rt := m.ensureRuntimeLocked(sess)
	flow := rt.flow
	if flow != nil && (strings.TrimSpace(flowID) == "" || flow.flowID == strings.TrimSpace(flowID)) {
		rt.flow = nil
	} else {
		flow = nil
	}
	m.mu.Unlock()

	if flow != nil {
		flow.mu.Lock()
		cancel := flow.cancel
		flow.pollResult.Stage = AuthStageCancelled
		flow.creds = TokenCredentials{}
		flow.mu.Unlock()
		if cancel != nil {
			cancel()
		}
	}
	return nil
}

func (m *Manager) ConnectAccount(sess *profilemgr.Session, flowID, accountName string) (AccountDTO, error) {
	m.mu.Lock()
	rt := m.ensureRuntimeLocked(sess)
	flow := rt.flow
	m.mu.Unlock()

	if flow == nil || (strings.TrimSpace(flowID) != "" && flow.flowID != strings.TrimSpace(flowID)) {
		return AccountDTO{}, apperr.New(apperr.CodeWBAuthRequired, "请先完成 WorkBuddy 浏览器授权")
	}
	flow.mu.Lock()
	poll := flow.pollResult
	creds := flow.creds
	quota := flow.quota
	flow.mu.Unlock()

	if poll.Stage == AuthStageNotBound {
		return AccountDTO{}, apperr.New(apperr.CodeWBNotBound, "当前 WorkBuddy 账号尚未开通智能体邮箱服务")
	}
	if poll.Stage != AuthStageAuthorized || poll.AliasID == "" || poll.Email == "" || creds.AccessToken == "" {
		return AccountDTO{}, apperr.New(apperr.CodeWBAuthRequired, "浏览器授权尚未完成，请确认授权后再试")
	}

	existingList, _ := listStoredAccounts(sess)
	accountID := newOpaqueID("wbacc")
	for _, item := range existingList {
		if strings.EqualFold(item.Email, poll.Email) || (item.Credentials.UID != "" && item.Credentials.UID == creds.UID && item.AliasID == poll.AliasID) {
			accountID = item.AccountID
			break
		}
	}

	rec := storedAccount{
		AccountID:       accountID,
		WorkspaceID:     sess.Meta.ID,
		AccountName:     resolveWorkBuddyDisplayName(accountName),
		Email:           poll.Email,
		AliasID:         poll.AliasID,
		Aliases:         append([]Alias(nil), poll.Aliases...),
		MailboxStatus:   poll.MailboxStatus,
		DailyQuota:      quota,
		LastRefreshedAt: time.Now().UnixMilli(),
		Credentials:     creds,
	}
	if err := saveStoredAccount(sess, rec); err != nil {
		return AccountDTO{}, err
	}

	m.mu.Lock()
	if rt.flow == flow {
		rt.flow = nil
	}
	delete(rt.clients, accountID)
	m.mu.Unlock()
	if flow.cancel != nil {
		flow.cancel()
	}
	return rec.toDTO(), nil
}

func (m *Manager) DisconnectAccount(sess *profilemgr.Session, accountID string) error {
	rec, err := deleteStoredAccount(sess, accountID)
	if err != nil {
		return err
	}
	m.mu.Lock()
	if m.active != nil && m.active.workspaceID == sess.Meta.ID {
		delete(m.active.clients, rec.AccountID)
	}
	m.mu.Unlock()

	if rec.Credentials.RefreshToken != "" {
		if authClient, err := NewAuthClient(rec.Credentials.BaseURL, m.transportCfg); err == nil {
			logoutCtx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
			_ = authClient.Logout(logoutCtx, rec.Credentials)
			cancel()
		}
	}
	return nil
}

func resolveWorkBuddyDisplayName(custom string) string {
	trimmed := clampRunes(strings.TrimSpace(custom), 64)
	if trimmed != "" {
		return trimmed
	}
	return "WorkBuddy 智能体邮箱"
}
