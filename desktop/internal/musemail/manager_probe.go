package musemail

import (
	"context"
	"time"

	"omnimail/internal/profilemgr"
)

// CheckLoginSessionReady 仅读取独立 WebView2 容器本地 Cookie 池判断是否已写入有效 hatch_sess，不产生任何外部网关请求。
func (m *Manager) CheckLoginSessionReady(sess *profilemgr.Session) LoginSessionProbeDTO {
	if sess == nil {
		return LoginSessionProbeDTO{}
	}
	m.mu.Lock()
	st := m.ensureProfileStateLocked(sess)
	win := st.loginWin
	verifying := st.cancelVerify != nil
	baseCtx := st.profileCtx
	m.mu.Unlock()

	if win == nil || !win.IsAlive() {
		return LoginSessionProbeDTO{}
	}
	if verifying {
		return LoginSessionProbeDTO{WindowOpen: true}
	}
	ctx, cancel := context.WithTimeout(baseCtx, 1500*time.Millisecond)
	defer cancel()
	rawCookies, err := win.ExtractMuseCookies(ctx)
	if err != nil {
		return LoginSessionProbeDTO{WindowOpen: win.IsAlive()}
	}
	_, hdrErr := BuildMinimalMuseCookieHeader(rawCookies, time.Now())
	return LoginSessionProbeDTO{
		WindowOpen:   win.IsAlive(),
		SessionReady: hdrErr == nil,
	}
}

func (m *Manager) Disconnect(sess *profilemgr.Session) StatusDTO {
	m.mu.Lock()
	if sess == nil || m.activeState == nil || m.activeState.profileID != sess.Meta.ID {
		m.mu.Unlock()
		return StatusDTO{LoginStage: "idle"}
	}
	old := m.activeState
	m.activeState = newProfileRuntimeState(sess.Meta.ID, sess.Ctx)
	snap := m.activeState.statusSnapshot()
	m.mu.Unlock()
	destroyRuntimeState(old)
	return snap
}

func (m *Manager) CancelActiveRequests(sess *profilemgr.Session) {
	if sess == nil {
		return
	}
	m.mu.Lock()
	if st := m.activeState; st != nil && st.profileID == sess.Meta.ID {
		for _, fn := range []*context.CancelFunc{&st.cancelVerify, &st.cancelList, &st.cancelThread} {
			if *fn != nil {
				(*fn)()
				*fn = nil
			}
		}
	}
	m.mu.Unlock()
}

func (m *Manager) clearCancelVerifyIfCurrent(st *profileRuntimeState) {
	m.mu.Lock()
	if m.activeState == st {
		st.cancelVerify = nil
	}
	m.mu.Unlock()
}
