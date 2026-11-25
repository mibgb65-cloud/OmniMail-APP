package workbuddymail

import (
	"context"
	"strings"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/profilemgr"
)

func newWorkspaceRuntime(sess *profilemgr.Session) *workspaceRuntime {
	ctx := sess.Ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return &workspaceRuntime{
		workspaceID: sess.Meta.ID,
		ctx:         ctx,
		clients:     make(map[string]*Client),
	}
}

func teardownRuntime(rt *workspaceRuntime) {
	if rt == nil || rt.flow == nil {
		return
	}
	rt.flow.mu.Lock()
	cancel := rt.flow.cancel
	rt.flow.creds = TokenCredentials{}
	rt.flow.mu.Unlock()
	if cancel != nil {
		cancel()
	}
}

func (m *Manager) ensureRuntimeLocked(sess *profilemgr.Session) *workspaceRuntime {
	if m.active == nil || m.active.workspaceID != sess.Meta.ID {
		old := m.active
		m.active = newWorkspaceRuntime(sess)
		go teardownRuntime(old)
	}
	return m.active
}

func (m *Manager) finishFlowError(flow *pendingAuthFlow, err error) {
	code := apperr.CodeOf(err)
	stage := AuthStageError
	if code == apperr.CodeWBCancelled {
		stage = AuthStageCancelled
	} else if code == apperr.CodeWBAuthTimeout {
		stage = AuthStageTimeout
	}
	flow.mu.Lock()
	if flow.pollResult.Stage == AuthStagePolling {
		flow.pollResult.Stage = stage
		flow.pollResult.ErrorCode = code
		flow.pollResult.ErrorMessage = err.Error()
	}
	flow.mu.Unlock()
}

func (m *Manager) clientAndAlias(sess *profilemgr.Session, accountID, aliasID string) (*Client, string, error) {
	cli, rec, err := m.clientForAccount(sess, accountID)
	if err != nil {
		return nil, "", err
	}
	resolved := strings.TrimSpace(aliasID)
	if resolved == "" {
		resolved = rec.AliasID
	}
	if resolved == "" {
		return nil, "", apperr.New(apperr.CodeWBNotBound, "当前智能体邮箱缺少有效别名")
	}
	return cli, resolved, nil
}

func (m *Manager) clientForAccount(sess *profilemgr.Session, accountID string) (*Client, storedAccount, error) {
	rec, err := m.resolveStoredAccount(sess, accountID)
	if err != nil {
		return nil, storedAccount{}, err
	}
	m.mu.Lock()
	rt := m.ensureRuntimeLocked(sess)
	if existing, ok := rt.clients[rec.AccountID]; ok {
		m.mu.Unlock()
		return existing, rec, nil
	}
	m.mu.Unlock()

	targetID := rec.AccountID
	cli, err := NewClient(rec.Credentials, m.transportCfg, func(updated TokenCredentials) error {
		latest, loadErr := loadStoredAccount(sess, targetID)
		if loadErr != nil {
			return loadErr
		}
		latest.Credentials = updated
		return saveStoredAccount(sess, latest)
	})
	if err != nil {
		return nil, storedAccount{}, err
	}

	m.mu.Lock()
	rt = m.ensureRuntimeLocked(sess)
	rt.clients[rec.AccountID] = cli
	m.mu.Unlock()
	return cli, rec, nil
}

func (m *Manager) resolveStoredAccount(sess *profilemgr.Session, accountID string) (storedAccount, error) {
	trimmed := strings.TrimSpace(accountID)
	if trimmed != "" {
		return loadStoredAccount(sess, trimmed)
	}
	list, err := listStoredAccounts(sess)
	if err != nil {
		return storedAccount{}, err
	}
	if len(list) == 0 {
		return storedAccount{}, apperr.New(apperr.CodeNotFound, "当前工作空间尚未接入 WorkBuddy 邮箱")
	}
	return list[0], nil
}

func (m *Manager) touchAccountQuota(sess *profilemgr.Session, accountID string, quota DailyQuota) {
	rec, err := m.resolveStoredAccount(sess, accountID)
	if err != nil {
		return
	}
	if quota.HasQuota {
		rec.DailyQuota = quota
	}
	rec.LastRefreshedAt = time.Now().UnixMilli()
	_ = saveStoredAccount(sess, rec)
}
