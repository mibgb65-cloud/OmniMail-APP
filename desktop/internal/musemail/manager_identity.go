package musemail

import (
	"context"

	"omnimail/internal/apperr"
)

// ensureVerifiedSession 确保在同一已认证连接上核验当前绑定 @muse.ai 身份；若重连后身份变更则立即清空状态并阻断读取。
func (m *Manager) ensureVerifiedSession(ctx context.Context, st *profileRuntimeState, expectedEmail string) (GatewaySession, string, error) {
	m.mu.Lock()
	gw := st.gw
	connID := st.connID
	cookieHdr := st.cookieHeader
	m.mu.Unlock()

	if gw != nil {
		actualEmail, err := gw.GetMailboxEmail(ctx)
		if err == nil {
			if actualEmail != expectedEmail {
				m.invalidateOnIdentityChange(st)
				return nil, "", errIdentityChanged()
			}
			return gw, connID, nil
		}
		err = classifyContextOrNetErr(err)
		code := apperr.CodeOf(err)
		if code == apperr.CodeMuseNotEnabled || code == apperr.CodeMuseAuthExpired || code == apperr.CodeMuseCancelled {
			m.handleTransportFailure(st, gw, err)
			return nil, "", err
		}
		m.dropBrokenConnection(st, gw)
	}

	if cookieHdr == "" {
		return nil, "", errAuthExpired()
	}

	newGW, err := m.connector.Connect(ctx, cookieHdr)
	if err != nil {
		m.setErrorIfActive(st, err)
		return nil, "", err
	}
	actualEmail, err := newGW.GetMailboxEmail(ctx)
	if err != nil {
		_ = newGW.Close()
		m.setErrorIfActive(st, err)
		return nil, "", err
	}
	if actualEmail != expectedEmail {
		_ = newGW.Close()
		m.invalidateOnIdentityChange(st)
		return nil, "", errIdentityChanged()
	}

	newConnID := randomOpaqueToken()
	m.mu.Lock()
	if m.activeState != st || !st.bound || ctx.Err() != nil {
		m.mu.Unlock()
		_ = newGW.Close()
		return nil, "", errCancelled()
	}
	oldGW := st.gw
	st.gw = newGW
	st.connID = newConnID
	m.mu.Unlock()

	if oldGW != nil && oldGW != newGW {
		_ = oldGW.Close()
	}
	return newGW, newConnID, nil
}

func (m *Manager) invalidateOnIdentityChange(st *profileRuntimeState) {
	var oldGW GatewaySession
	var oldWin LoginWindow
	m.mu.Lock()
	if m.activeState == st {
		oldGW = st.gw
		oldWin = st.loginWin
		st.gw = nil
		st.loginWin = nil
		st.cookieHeader = ""
		st.verifiedEmail = ""
		st.boundEmail = ""
		st.bound = false
		st.lastRefreshedAt = 0
		st.lastErrorCode = apperr.CodeMuseIdentityChanged
		st.resetLoadedCollectionLocked()
	}
	m.mu.Unlock()
	if oldGW != nil {
		_ = oldGW.Close()
	}
	if oldWin != nil {
		_ = oldWin.Close()
	}
}

func (m *Manager) dropBrokenConnection(st *profileRuntimeState, broken GatewaySession) {
	var toClose GatewaySession
	m.mu.Lock()
	if m.activeState == st && st.gw == broken {
		toClose = st.gw
		st.gw = nil
	}
	m.mu.Unlock()
	if toClose != nil {
		_ = toClose.Close()
	}
}

func (m *Manager) handleTransportFailure(st *profileRuntimeState, gw GatewaySession, err error) {
	code := apperr.CodeOf(err)
	if code == apperr.CodeMuseCancelled {
		return
	}
	var toClose GatewaySession
	m.mu.Lock()
	if m.activeState == st {
		recordSanitizedErr(st, err)
		if st.gw == gw {
			toClose = st.gw
			st.gw = nil
		}
		if code == apperr.CodeMuseAuthExpired {
			st.cookieHeader = ""
		}
	}
	m.mu.Unlock()
	if toClose != nil {
		_ = toClose.Close()
	}
}
