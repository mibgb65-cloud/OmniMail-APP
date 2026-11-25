package workbuddymail

import (
	"context"
	"sync"
	"time"

	"omnimail/internal/config"
	"omnimail/internal/profilemgr"
)

type pendingAuthFlow struct {
	mu         sync.Mutex
	flowID     string
	state      string
	authURL    string
	baseURL    string
	cancel     context.CancelFunc
	pollResult AuthPollResult
	creds      TokenCredentials
	quota      DailyQuota
}

type workspaceRuntime struct {
	workspaceID string
	ctx         context.Context
	flow        *pendingAuthFlow
	clients     map[string]*Client
}

// Manager 管理活跃空间的 WorkBuddy 授权流程与客户端实例，实现 profilemgr.SessionHook。
type Manager struct {
	mu           sync.Mutex
	transportCfg TransportConfig
	pollInterval time.Duration
	authTimeout  time.Duration
	active       *workspaceRuntime
}

func NewManager() *Manager {
	return NewManagerWithConfig(TransportConfig{})
}

func NewManagerWithConfig(cfg TransportConfig) *Manager {
	return &Manager{
		transportCfg: cfg,
		pollInterval: time.Second,
		authTimeout:  5 * time.Minute,
	}
}

func (m *Manager) OnSessionOpened(sess *profilemgr.Session) {
	if sess == nil {
		return
	}
	m.mu.Lock()
	if m.active != nil && m.active.workspaceID == sess.Meta.ID {
		m.mu.Unlock()
		return
	}
	old := m.active
	m.active = newWorkspaceRuntime(sess)
	m.mu.Unlock()
	teardownRuntime(old)
}

func (m *Manager) OnSessionClosing(_ *profilemgr.Session) {
	m.mu.Lock()
	old := m.active
	m.active = nil
	m.mu.Unlock()
	teardownRuntime(old)
}

func (m *Manager) OnSettingsChanged(_ *profilemgr.Session, _ config.AppSettings) {}

func (m *Manager) Close() { m.OnSessionClosing(nil) }

func (m *Manager) StartAuth(sess *profilemgr.Session, baseURL string) (AuthStartResult, error) {
	authClient, err := NewAuthClient(baseURL, m.transportCfg)
	if err != nil {
		return AuthStartResult{}, err
	}
	authClient.SetPollInterval(m.pollInterval)

	reqCtx, cancelReq := context.WithTimeout(sess.Ctx, 12*time.Second)
	defer cancelReq()
	started, err := authClient.StartBrowserAuth(reqCtx)
	if err != nil {
		return AuthStartResult{}, err
	}
	flowID := newOpaqueID("wbflow")
	started.FlowID = flowID

	m.mu.Lock()
	rt := m.ensureRuntimeLocked(sess)
	if rt.flow != nil && rt.flow.cancel != nil {
		rt.flow.cancel()
	}
	pollCtx, cancelPoll := context.WithTimeout(rt.ctx, m.authTimeout)
	flow := &pendingAuthFlow{
		flowID:     flowID,
		state:      started.State,
		authURL:    started.AuthURL,
		baseURL:    started.BaseURL,
		cancel:     cancelPoll,
		pollResult: AuthPollResult{FlowID: flowID, Stage: AuthStagePolling},
	}
	rt.flow = flow
	m.mu.Unlock()

	go m.runAuthPollLoop(pollCtx, authClient, flow)
	return started, nil
}

func (m *Manager) runAuthPollLoop(ctx context.Context, authClient *AuthClient, flow *pendingAuthFlow) {
	creds, err := authClient.PollAuthToken(ctx, flow.state)
	if err != nil {
		m.finishFlowError(flow, err)
		return
	}
	creds, err = authClient.FetchAccountInfo(ctx, creds)
	if err != nil {
		m.finishFlowError(flow, err)
		return
	}
	cli, err := NewClient(creds, m.transportCfg, nil)
	if err != nil {
		m.finishFlowError(flow, err)
		return
	}
	connState, err := cli.GetConnectorStatus(ctx)
	if err != nil {
		m.finishFlowError(flow, err)
		return
	}
	if connState.Status != StatusRunning && connState.Status != StatusDeactivated {
		flow.mu.Lock()
		flow.creds = cli.Credentials()
		flow.pollResult.Stage = AuthStageNotBound
		flow.pollResult.MailboxStatus = connState.Status
		flow.pollResult.UID = creds.UID
		flow.mu.Unlock()
		return
	}
	aliases, primary, quota, err := cli.GetMeAndAliases(ctx, connState.Alias)
	if err != nil {
		m.finishFlowError(flow, err)
		return
	}
	flow.mu.Lock()
	flow.creds = cli.Credentials()
	flow.quota = quota
	flow.pollResult = AuthPollResult{
		FlowID:        flow.flowID,
		Stage:         AuthStageAuthorized,
		MailboxStatus: connState.Status,
		Email:         primary.Email,
		AliasID:       primary.AliasID,
		Aliases:       aliases,
		UID:           creds.UID,
	}
	flow.mu.Unlock()
}
