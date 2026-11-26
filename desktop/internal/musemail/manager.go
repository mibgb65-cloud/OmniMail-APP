package musemail

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"strings"
	"sync"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/profilemgr"
)

type profileRuntimeState struct {
	profileID       string
	profileCtx      context.Context
	connID          string
	loginWin        LoginWindow
	gw              GatewaySession
	cookieHeader    string
	verifiedEmail   string
	boundEmail      string
	accountName     string
	bound           bool
	refreshEpoch    uint64
	lastRefreshedAt int64
	lastErrorCode   string

	cursorMap     map[string]cursorEntry
	usedUpstream  map[string]struct{}
	seenThreads   map[string]struct{}
	loadedThreads map[string]struct{}

	cancelVerify context.CancelFunc
	cancelList   context.CancelFunc
	cancelThread context.CancelFunc
}

type cursorEntry struct {
	profileID      string
	connID         string
	refreshEpoch   uint64
	upstreamCursor string
}

// Manager 维护当前活跃空间的 Muse Mail 内存只读会话，实现 profilemgr.SessionHook。
type Manager struct {
	mu          sync.Mutex
	hostFactory LoginHostFactory
	connector   GatewayConnector
	activeState *profileRuntimeState
}

func NewManager() *Manager {
	return NewManagerWithDeps(newDefaultLoginWindow, NewLiveConnector())
}

func NewManagerWithDeps(hostFactory LoginHostFactory, connector GatewayConnector) *Manager {
	if hostFactory == nil {
		hostFactory = newDefaultLoginWindow
	}
	if connector == nil {
		connector = NewLiveConnector()
	}
	return &Manager{hostFactory: hostFactory, connector: connector}
}

func (m *Manager) OnSessionOpened(sess *profilemgr.Session) {
	if sess == nil {
		return
	}
	m.mu.Lock()
	if m.activeState != nil && m.activeState.profileID == sess.Meta.ID {
		m.mu.Unlock()
		return
	}
	old := m.activeState
	m.activeState = newProfileRuntimeState(sess.Meta.ID, sess.Ctx)
	m.mu.Unlock()
	destroyRuntimeState(old)
}

func (m *Manager) OnSessionClosing(_ *profilemgr.Session) {
	m.mu.Lock()
	old := m.activeState
	m.activeState = nil
	m.mu.Unlock()
	destroyRuntimeState(old)
}

func (m *Manager) OnSettingsChanged(_ *profilemgr.Session, _ config.AppSettings) {}

func (m *Manager) Close() {
	m.OnSessionClosing(nil)
	sweepStaleMuseWebViewDirs()
}

func newProfileRuntimeState(profileID string, ctx context.Context) *profileRuntimeState {
	if ctx == nil {
		ctx = context.Background()
	}
	st := &profileRuntimeState{profileID: profileID, profileCtx: ctx}
	st.resetLoadedCollectionLocked()
	return st
}

func destroyRuntimeState(st *profileRuntimeState) {
	if st == nil {
		return
	}
	if st.cancelVerify != nil {
		st.cancelVerify()
	}
	if st.cancelList != nil {
		st.cancelList()
	}
	if st.cancelThread != nil {
		st.cancelThread()
	}
	gw, win := st.gw, st.loginWin
	*st = profileRuntimeState{profileID: st.profileID}
	if gw != nil {
		_ = gw.Close()
	}
	if win != nil {
		_ = win.Close()
	}
}

func (m *Manager) ensureProfileStateLocked(sess *profilemgr.Session) *profileRuntimeState {
	if m.activeState == nil || m.activeState.profileID != sess.Meta.ID {
		old := m.activeState
		m.activeState = newProfileRuntimeState(sess.Meta.ID, sess.Ctx)
		go destroyRuntimeState(old)
	}
	return m.activeState
}

func (st *profileRuntimeState) statusSnapshot() StatusDTO {
	stage := "idle"
	switch {
	case st.bound && st.boundEmail != "":
		stage = "connected"
	case st.verifiedEmail != "":
		stage = "verified"
	case st.loginWin != nil && st.loginWin.IsAlive():
		stage = "login_open"
	}
	email := st.boundEmail
	if email == "" {
		email = st.verifiedEmail
	}
	return StatusDTO{
		LoginStage:      stage,
		Bound:           st.bound,
		VerifiedEmail:   email,
		AccountName:     st.accountName,
		LastRefreshedAt: st.lastRefreshedAt,
		LastErrorCode:   st.lastErrorCode,
	}
}

func randomOpaqueToken() string {
	var b [12]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

func defaultMuseDisplayName(customName, email string) string {
	if name := clampRunes(strings.TrimSpace(customName), 64); name != "" {
		return name
	}
	return "Muse"
}

func recordSanitizedErr(st *profileRuntimeState, err error) {
	if st == nil || err == nil {
		return
	}
	if code := apperr.CodeOf(err); code != "" && code != apperr.CodeMuseCancelled {
		st.lastErrorCode = code
	}
}
