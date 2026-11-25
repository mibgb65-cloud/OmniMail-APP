package musemail

import (
	"context"
	"strings"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/profilemgr"
)

func (m *Manager) GetStatus(sess *profilemgr.Session) StatusDTO {
	if sess == nil {
		return StatusDTO{LoginStage: "idle"}
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.ensureProfileStateLocked(sess).statusSnapshot()
}

func (m *Manager) BeginConnect(sess *profilemgr.Session) (StatusDTO, error) {
	if sess == nil {
		return StatusDTO{LoginStage: "idle"}, apperr.New(apperr.CodePinRequired, "请先解锁当前工作空间")
	}
	m.mu.Lock()
	st := m.ensureProfileStateLocked(sess)
	if st.cancelVerify != nil {
		st.cancelVerify()
		st.cancelVerify = nil
	}
	oldWin, oldGW, wasBound := st.loginWin, st.gw, st.bound
	st.loginWin = nil
	if !wasBound {
		st.gw, st.verifiedEmail, st.cookieHeader = nil, "", ""
	}
	st.lastErrorCode = ""
	m.mu.Unlock()

	if oldWin != nil {
		_ = oldWin.Close()
	}
	if !wasBound && oldGW != nil {
		_ = oldGW.Close()
	}

	win, err := m.hostFactory()
	if err != nil {
		m.setErrorIfActive(st, err)
		return StatusDTO{LoginStage: "idle"}, err
	}
	m.mu.Lock()
	if m.activeState != st {
		m.mu.Unlock()
		_ = win.Close()
		return StatusDTO{LoginStage: "idle"}, errCancelled()
	}
	st.loginWin = win
	snap := st.statusSnapshot()
	m.mu.Unlock()
	return snap, nil
}

func (m *Manager) VerifyConnection(sess *profilemgr.Session) (VerifyResultDTO, error) {
	if sess == nil {
		return VerifyResultDTO{}, apperr.New(apperr.CodePinRequired, "请先解锁当前工作空间")
	}
	m.mu.Lock()
	st := m.ensureProfileStateLocked(sess)
	if st.cancelVerify != nil {
		st.cancelVerify()
	}
	ctx, cancel := context.WithTimeout(st.profileCtx, 45*time.Second)
	st.cancelVerify = cancel
	win := st.loginWin
	m.mu.Unlock()
	defer cancel()

	if win == nil || !win.IsAlive() {
		return VerifyResultDTO{}, errNotLoggedIn()
	}
	rawCookies, err := win.ExtractMuseCookies(ctx)
	if err != nil {
		return VerifyResultDTO{}, err
	}
	cookieHdr, err := BuildMinimalMuseCookieHeader(rawCookies, time.Now())
	if err != nil {
		return VerifyResultDTO{}, err
	}
	gw, err := m.connector.Connect(ctx, cookieHdr)
	if err != nil {
		m.setErrorIfActive(st, err)
		return VerifyResultDTO{}, err
	}
	email, err := gw.GetMailboxEmail(ctx)
	if err != nil {
		_ = gw.Close()
		m.setErrorIfActive(st, err)
		return VerifyResultDTO{}, err
	}

	m.mu.Lock()
	if m.activeState != st || ctx.Err() != nil {
		m.mu.Unlock()
		_ = gw.Close()
		return VerifyResultDTO{}, errCancelled()
	}
	oldGW, oldWin := st.gw, st.loginWin
	st.gw, st.loginWin = gw, nil
	st.cookieHeader, st.verifiedEmail = cookieHdr, email
	st.connID, st.lastErrorCode = randomOpaqueToken(), ""
	if st.bound && st.boundEmail != "" && st.boundEmail != email {
		st.bound, st.boundEmail = false, ""
		st.resetLoadedCollectionLocked()
	}
	m.mu.Unlock()

	if oldGW != nil {
		_ = oldGW.Close()
	}
	if oldWin != nil {
		_ = oldWin.Close()
	}
	return VerifyResultDTO{Email: email, LoginStage: "verified"}, nil
}

func (m *Manager) ConfirmConnection(sess *profilemgr.Session, accountName string) (StatusDTO, error) {
	if sess == nil {
		return StatusDTO{LoginStage: "idle"}, apperr.New(apperr.CodePinRequired, "请先解锁当前工作空间")
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	st := m.ensureProfileStateLocked(sess)
	if st.gw == nil || st.verifiedEmail == "" {
		return st.statusSnapshot(), errNotLoggedIn()
	}
	st.bound, st.boundEmail = true, st.verifiedEmail
	st.accountName = defaultMuseDisplayName(accountName, st.verifiedEmail)
	st.lastErrorCode = ""
	st.refreshEpoch++
	st.resetLoadedCollectionLocked()
	if st.connID == "" {
		st.connID = randomOpaqueToken()
	}
	return st.statusSnapshot(), nil
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

func (st *profileRuntimeState) resetLoadedCollectionLocked() {
	st.cursorMap = make(map[string]cursorEntry)
	st.usedUpstream = make(map[string]struct{})
	st.seenThreads = make(map[string]struct{})
	st.loadedThreads = make(map[string]struct{})
}

func (m *Manager) setErrorIfActive(st *profileRuntimeState, err error) {
	m.mu.Lock()
	if m.activeState == st {
		recordSanitizedErr(st, err)
	}
	m.mu.Unlock()
}

func sanitizeCursorInput(cursor string) string {
	if c := strings.TrimSpace(cursor); len(c) <= 128 {
		return c
	}
	return ""
}
