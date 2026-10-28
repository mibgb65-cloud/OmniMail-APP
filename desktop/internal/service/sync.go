package service

import (
	"context"
	"errors"
	"time"

	"omnimail/desktop/internal/domain"
)

func (s *Mail) Start() {
	s.mu.Lock()
	if s.closed || s.started {
		s.mu.Unlock()
		return
	}
	s.started = true
	s.wg.Add(1)
	s.mu.Unlock()
	go func() {
		defer s.wg.Done()
		s.queueAll()
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				s.queueAll()
			case <-s.ctx.Done():
				return
			}
		}
	}()
}

func (s *Mail) queueAll() {
	accounts, err := s.store.ListAccounts(s.ctx)
	if err != nil {
		if s.ctx.Err() == nil {
			s.log.Warn("读取同步账号失败", "code", "STORAGE_FAILED")
		}
		return
	}
	for _, account := range accounts {
		if account.SyncEnabled && account.Status == domain.AccountConfigured {
			if err := s.QueueSync(account.ID); err != nil && ErrorCode(err) != "BUSY" && s.ctx.Err() == nil {
				s.log.Warn("安排同步失败", "code", ErrorCode(err))
			}
		}
	}
}

func (s *Mail) QueueSync(id string) error {
	if !domain.ValidAccountID(id) {
		return domain.ErrInvalidAccount
	}
	account, err := s.store.GetAccount(s.ctx, id)
	if err != nil {
		return err
	}
	if account.Status != domain.AccountConfigured || !account.SyncEnabled {
		return domain.ErrCredentialMissing
	}
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return context.Canceled
	}
	if s.active[id] {
		s.mu.Unlock()
		return errors.New("BUSY")
	}
	s.active[id] = true
	state := s.states[id]
	state.Running = true
	state.ErrorCode = ""
	s.states[id] = state
	s.wg.Add(1)
	s.mu.Unlock()
	go func() {
		defer s.wg.Done()
		ctx, cancel := context.WithTimeout(s.ctx, 60*time.Second)
		defer cancel()
		more, err := s.syncAccount(ctx, id)
		if errors.Is(err, domain.ErrAuthentication) || errors.Is(err, domain.ErrCredentialMissing) {
			s.markReauth(id)
		}
		s.mu.Lock()
		state := s.states[id]
		state.Running = false
		state.More = more
		state.ErrorCode = ErrorCode(err)
		if err == nil {
			state.LastSyncAt = time.Now().UnixMilli()
		}
		s.states[id] = state
		delete(s.active, id)
		s.mu.Unlock()
		if more && err == nil {
			s.continueSync(id)
		}
	}()
	return nil
}

func (s *Mail) continueSync(id string) {
	s.mu.Lock()
	if s.closed || s.pending[id] {
		s.mu.Unlock()
		return
	}
	s.pending[id] = true
	s.wg.Add(1)
	s.mu.Unlock()
	go func() {
		defer s.wg.Done()
		timer := time.NewTimer(5 * time.Second)
		defer timer.Stop()
		select {
		case <-s.ctx.Done():
			return
		case <-timer.C:
			s.mu.Lock()
			delete(s.pending, id)
			s.mu.Unlock()
			if err := s.QueueSync(id); err != nil && ErrorCode(err) != "BUSY" && s.ctx.Err() == nil {
				s.log.Warn("继续历史同步失败", "code", ErrorCode(err))
			}
		}
	}()
}

func (s *Mail) markReauth(id string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	account, err := s.store.GetAccount(ctx, id)
	if err == nil && account.Status == domain.AccountConfigured {
		account.Status = domain.AccountReauth
		_, err = s.store.UpdateAccount(ctx, account)
	}
	if err != nil {
		s.log.Warn("保存重新授权状态失败", "code", "STORAGE_FAILED")
	}
}

func (s *Mail) syncAccount(ctx context.Context, id string) (more bool, err error) {
	defer func() {
		if ctx.Err() != nil {
			err = ctx.Err()
		}
	}()
	if err := s.acquire(ctx); err != nil {
		return false, err
	}
	defer func() { <-s.network }()
	account, err := s.store.GetAccount(ctx, id)
	if err != nil {
		return false, err
	}
	if !account.SyncEnabled || account.Status != domain.AccountConfigured {
		return false, domain.ErrCredentialMissing
	}
	connection, err := endpoint(account, domain.ProtocolIMAP)
	if err != nil {
		return false, err
	}
	secret, err := s.secrets.Get(ctx, connection.CredentialRef)
	if err != nil {
		return false, err
	}
	defer clear(secret)
	session, err := s.transport.Connect(ctx, connection, secret)
	if err != nil {
		return false, err
	}
	defer func() {
		if closeError := session.Close(); closeError != nil && ctx.Err() == nil {
			s.log.Warn("关闭收信连接失败", "code", "NETWORK_FAILED")
		}
	}()
	boxes, err := session.Mailboxes()
	if err != nil {
		return false, err
	}
	for _, box := range boxes {
		pending, err := s.syncMailbox(ctx, id, box, session)
		if err != nil {
			return more, err
		}
		more = more || pending
	}
	return more, nil
}

func (s *Mail) syncMailbox(ctx context.Context, accountID string, box domain.RemoteMailbox, session domain.MailSession) (bool, error) {
	validity, next, err := session.Select(box.Name)
	if err != nil || validity == 0 || next == 0 {
		return false, domain.ErrProtocol
	}
	cursor, err := s.store.PrepareMailbox(ctx, accountID, box, validity)
	if err != nil {
		return false, err
	}
	last := next - 1
	startNew := cursor.LastUID + 1
	// 首次优先读取靠近末端的窗口；旧邮件仍由下方可恢复的历史重对账补齐，不永久截断历史。
	if cursor.LastUID == 0 && last > 5000 {
		startNew = last - 4999
	}
	finished, batches, err := s.syncPass(ctx, accountID, cursor.ID, validity, startNew, last, 50, false, session)
	if err != nil || !finished {
		return true, err
	}
	// 分段重对账刷新已读/星标并删除区间内消失的 UID，不把旧游标误当成已处理新邮件。
	start := cursor.ScanUID + 1
	if start == 0 || start > last {
		start = 1
	}
	finished, _, err = s.syncPass(ctx, accountID, cursor.ID, validity, start, last, 50-batches, true, session)
	return !finished, err
}

func (s *Mail) syncPass(ctx context.Context, accountID, mailboxID string, validity, start, last uint32, limit int, scan bool,
	session domain.MailSession) (bool, int, error) {
	if start == 0 || start > last {
		return true, 0, nil
	}
	for batch := 0; batch < limit; batch++ {
		if ctx.Err() != nil {
			return false, batch, ctx.Err()
		}
		window, err := s.nextWindow(ctx, session, mailboxID, start, last)
		if err != nil {
			return false, batch, err
		}
		start = window
		end := min(start+99, last)
		if end < start {
			end = last
		}
		messages, err := session.Headers(start, end)
		if err != nil {
			return false, batch, err
		}
		scanValue := end
		if end == last {
			scanValue = 0
		}
		var scanNext *uint32
		if scan {
			scanNext = &scanValue
		}
		if err := s.store.SaveMailBatch(ctx, accountID, mailboxID, validity, start, end, messages, scanNext); err != nil {
			return false, batch, err
		}
		if end == last {
			return true, batch + 1, nil
		}
		start = end + 1
	}
	return false, limit, nil
}

func (s *Mail) nextWindow(ctx context.Context, session domain.MailSession, mailboxID string, from, last uint32) (uint32, error) {
	remote, remoteFound, err := session.LocateUID(from)
	if err != nil {
		return 0, err
	}
	local, localFound, err := s.store.NextCachedUID(ctx, mailboxID, from)
	if err != nil {
		return 0, err
	}
	next := last
	if remoteFound && remote <= last {
		next = remote
	}
	if localFound && local < next {
		next = local
	}
	return next, nil
}

func (s *Mail) Close() error {
	s.mu.Lock()
	s.closed = true
	s.cancel()
	s.mu.Unlock()
	s.wg.Wait()
	return nil
}

// ErrorCode 是唯一跨桥接的错误表示，不返回 SQL、服务器响应或 OS 诊断文本。
func ErrorCode(err error) string {
	if err == nil {
		return ""
	}
	if errors.Is(err, domain.ErrCredentialCleanup) {
		return domain.ErrCredentialCleanup.Error()
	}
	if errors.Is(err, context.Canceled) {
		return "CANCELED"
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "TIMEOUT"
	}
	for _, known := range []error{domain.ErrAuthentication, domain.ErrTLS, domain.ErrNetwork, domain.ErrProtocol,
		domain.ErrTooLarge, domain.ErrOAuthConfig, domain.ErrCredentialMissing, domain.ErrCredentialUnavailable, domain.ErrCredentialInvalid, domain.ErrSendUncertain} {
		if errors.Is(err, known) {
			return known.Error()
		}
	}
	if errors.Is(err, domain.ErrInvalidAccount) {
		return "INVALID_INPUT"
	}
	for _, code := range []string{"BUSY", "SEND_UNCERTAIN", "CREDENTIAL_CLEANUP_FAILED"} {
		if err.Error() == code {
			return code
		}
	}
	return "STORAGE_FAILED"
}
