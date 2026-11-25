package musemail

import (
	"context"
	"strings"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/profilemgr"
)

func (m *Manager) ListThreads(sess *profilemgr.Session, cursorToken string) (ThreadListDTO, error) {
	if sess == nil {
		return ThreadListDTO{}, apperr.New(apperr.CodePinRequired, "请先解锁当前工作空间")
	}
	cursorToken = sanitizeCursorInput(cursorToken)

	m.mu.Lock()
	st := m.ensureProfileStateLocked(sess)
	if !st.bound || st.boundEmail == "" {
		m.mu.Unlock()
		return ThreadListDTO{}, errNotLoggedIn()
	}
	if st.cancelList != nil {
		st.cancelList()
	}
	ctx, cancel := context.WithTimeout(st.profileCtx, 45*time.Second)
	st.cancelList = cancel

	upstreamCursor := ""
	if cursorToken == "" {
		st.refreshEpoch++
		st.cursorMap = make(map[string]cursorEntry)
		st.usedUpstream = make(map[string]struct{})
		st.seenThreads = make(map[string]struct{})
		if st.loadedThreads == nil {
			st.loadedThreads = make(map[string]struct{})
		}
	} else {
		entry, ok := st.cursorMap[cursorToken]
		if !ok || entry.profileID != st.profileID || entry.connID != st.connID || entry.refreshEpoch != st.refreshEpoch {
			m.mu.Unlock()
			cancel()
			return ThreadListDTO{}, apperr.New(apperr.CodeInvalidInput, "分页游标已失效，请重新刷新列表")
		}
		upstreamCursor = entry.upstreamCursor
	}
	epochSnap := st.refreshEpoch
	expectedEmail := st.boundEmail
	accountName := st.accountName
	m.mu.Unlock()
	defer cancel()

	gw, connID, err := m.ensureVerifiedSession(ctx, st, expectedEmail)
	if err != nil {
		return ThreadListDTO{}, err
	}
	if cursorToken != "" {
		m.mu.Lock()
		valid := m.activeState == st && st.connID == connID && st.refreshEpoch == epochSnap
		m.mu.Unlock()
		if !valid {
			return ThreadListDTO{}, apperr.New(apperr.CodeInvalidInput, "连接已重建，请手动刷新会话列表")
		}
	}

	rawList, err := gw.ListThreadsRaw(ctx, upstreamCursor)
	if err != nil {
		err = classifyContextOrNetErr(err)
		m.handleTransportFailure(st, gw, err)
		return ThreadListDTO{}, err
	}
	rows, nextUpstream, err := parseThreadListPayload(rawList)
	if err != nil {
		m.setErrorIfActive(st, err)
		return ThreadListDTO{}, err
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	if m.activeState != st || !st.bound || st.refreshEpoch != epochSnap || ctx.Err() != nil {
		return ThreadListDTO{}, errCancelled()
	}
	deduped := make([]ThreadSummaryDTO, 0, len(rows))
	for _, r := range rows {
		if _, dup := st.seenThreads[r.ID]; dup {
			continue
		}
		st.seenThreads[r.ID] = struct{}{}
		st.loadedThreads[r.ID] = struct{}{}
		deduped = append(deduped, r)
	}

	nextToken := ""
	if nextUpstream != "" && nextUpstream != upstreamCursor {
		if _, seenCursor := st.usedUpstream[nextUpstream]; !seenCursor {
			st.usedUpstream[nextUpstream] = struct{}{}
			nextToken = randomOpaqueToken()
			st.cursorMap[nextToken] = cursorEntry{
				profileID:      st.profileID,
				connID:         st.connID,
				refreshEpoch:   st.refreshEpoch,
				upstreamCursor: nextUpstream,
			}
		}
	}
	nowMs := time.Now().UnixMilli()
	st.lastRefreshedAt = nowMs
	st.lastErrorCode = ""
	return ThreadListDTO{
		Email:           st.boundEmail,
		AccountName:     accountName,
		Threads:         deduped,
		NextCursor:      nextToken,
		HasMore:         nextToken != "",
		LastRefreshedAt: nowMs,
	}, nil
}

func (m *Manager) GetThread(sess *profilemgr.Session, threadRef string) (ThreadDetailDTO, error) {
	if sess == nil {
		return ThreadDetailDTO{}, apperr.New(apperr.CodePinRequired, "请先解锁当前工作空间")
	}
	tid := strings.TrimSpace(threadRef)
	if tid == "" || len(tid) > maxThreadIDLen {
		return ThreadDetailDTO{}, apperr.New(apperr.CodeInvalidInput, "无效的 Muse 会话引用")
	}

	m.mu.Lock()
	st := m.ensureProfileStateLocked(sess)
	if !st.bound || st.boundEmail == "" {
		m.mu.Unlock()
		return ThreadDetailDTO{}, errNotLoggedIn()
	}
	if _, loaded := st.loadedThreads[tid]; !loaded {
		m.mu.Unlock()
		return ThreadDetailDTO{}, apperr.New(apperr.CodeNotFound, "该会话不在当前已加载列表中，请刷新后重试")
	}
	if st.cancelThread != nil {
		st.cancelThread()
	}
	ctx, cancel := context.WithTimeout(st.profileCtx, 45*time.Second)
	st.cancelThread = cancel
	expectedEmail := st.boundEmail
	m.mu.Unlock()
	defer cancel()

	gw, _, err := m.ensureVerifiedSession(ctx, st, expectedEmail)
	if err != nil {
		return ThreadDetailDTO{}, err
	}
	rawDetail, err := gw.GetThreadRaw(ctx, tid)
	if err != nil {
		err = classifyContextOrNetErr(err)
		m.handleTransportFailure(st, gw, err)
		return ThreadDetailDTO{}, err
	}
	detail, err := parseThreadDetailPayload(tid, expectedEmail, rawDetail)
	if err != nil {
		m.setErrorIfActive(st, err)
		return ThreadDetailDTO{}, err
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	if m.activeState != st || !st.bound || st.boundEmail != expectedEmail || ctx.Err() != nil {
		return ThreadDetailDTO{}, errCancelled()
	}
	st.lastErrorCode = ""
	return detail, nil
}
