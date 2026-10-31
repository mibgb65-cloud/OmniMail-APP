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
	return s.queueSync(id, false)
}

func (s *Mail) queueSync(id string, continuation bool) error {
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
	// 读取账号可能等待 SQLite；用同一把锁重新检查续排资格，避免前台恰好已完成周期。
	if continuation && (!s.states[id].More || s.states[id].ErrorCode != "") {
		s.mu.Unlock()
		return nil
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
		s.logSyncFailure(err, account.ProviderCode)
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
			s.log.Info("邮件同步分批完成", "code", "SYNC_PROGRESS", "provider", safeSyncProvider(account.ProviderCode))
			s.continueSync(id)
		} else if err == nil {
			// 只记录周期结束，不包含账号或邮件数据；分批完成不宣称全量同步结束。
			s.log.Info("邮件同步周期完成", "code", "SYNC_COMPLETE", "provider", safeSyncProvider(account.ProviderCode))
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
			s.resumeSync(id)
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
			// 保留超时/取消优先级，同时保留操作阶段，不能用裸上下文错误盖掉诊断位置。
			err = errors.Join(ctx.Err(), err)
		}
	}()
	if err := s.acquire(ctx); err != nil {
		return false, syncStepError("wait_connection", "", err)
	}
	defer func() { <-s.network }()
	account, err := s.store.GetAccount(ctx, id)
	if err != nil {
		return false, syncStepError("load_account", "", err)
	}
	if !account.SyncEnabled || account.Status != domain.AccountConfigured {
		return false, syncStepError("load_account", "", domain.ErrCredentialMissing)
	}
	connection, err := endpoint(account, domain.ProtocolIMAP)
	if err != nil {
		return false, syncStepError("load_endpoint", "", err)
	}
	secret, err := s.secrets.Get(ctx, connection.CredentialRef)
	if err != nil {
		return false, syncStepError("load_credential", "", err)
	}
	defer clear(secret)
	session, err := s.transport.Connect(ctx, connection, secret)
	if err != nil {
		return false, syncStepError("connect", "", err)
	}
	defer func() {
		if closeError := session.Close(); closeError != nil && ctx.Err() == nil {
			s.log.Warn("关闭收信连接失败", "code", "NETWORK_FAILED")
		}
	}()
	boxes, err := session.Mailboxes()
	if err != nil {
		return false, syncStepError("list", "", err)
	}
	return s.syncMailboxes(ctx, id, boxes, session)
}

func (s *Mail) syncMailbox(ctx context.Context, accountID string, box domain.RemoteMailbox, session domain.MailSession) (bool, error) {
	ctx = bodySyncContext(ctx)
	validity, next, err := session.Select(box.Name)
	if err != nil {
		return false, syncStepError("select", box.Kind, err)
	}
	if validity == 0 || next == 0 {
		reason := "missing_uidnext"
		if validity == 0 {
			reason = "missing_uidvalidity"
		}
		return false, syncStepError("select", box.Kind, selectionMetadataFailure{reason: reason})
	}
	cursor, err := s.store.PrepareMailbox(ctx, accountID, box, validity)
	if err != nil {
		return false, syncStepError("cache_mailbox", box.Kind, err)
	}
	pending, downloaded, err := s.syncStoredBodies(ctx, accountID, cursor.ID, validity, session)
	if err != nil || pending || downloaded {
		// 已有摘要优先补齐；正文较多时下一轮从数据库继续，避免旧记录永远依赖用户点击。
		return pending || downloaded, syncMailboxError(box.Kind, err)
	}
	// 缺失 UIDNEXT 时协议层只能给出已有 UID 的上界；仍核对旧游标范围，删除必须由远端结果确认。
	last := max(next-1, cursor.LastUID)
	startNew := cursor.LastUID + 1
	// 首次优先读取靠近末端的窗口；旧邮件仍由下方可恢复的历史重对账补齐，不永久截断历史。
	if cursor.LastUID == 0 && last > 5000 {
		startNew = last - 4999
	}
	finished, batches, err := s.syncPass(ctx, accountID, cursor.ID, validity, startNew, last, 50, false, session)
	if err != nil || !finished {
		return true, syncMailboxError(box.Kind, err)
	}
	// 分段重对账刷新已读/星标并删除区间内消失的 UID，不把旧游标误当成已处理新邮件。
	start := cursor.ScanUID + 1
	if start == 0 || start > last {
		start = 1
	}
	finished, _, err = s.syncPass(ctx, accountID, cursor.ID, validity, start, last, 50-batches, true, session)
	if err != nil || !finished {
		return !finished, syncMailboxError(box.Kind, err)
	}
	pending, _, err = s.syncStoredBodies(ctx, accountID, cursor.ID, validity, session)
	return pending, syncMailboxError(box.Kind, err)
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
		if syncShouldYield(ctx) {
			return false, batch, nil
		}
		window, err := s.nextWindow(ctx, session, mailboxID, start, last)
		if err != nil {
			return false, batch, err
		}
		// SEARCH 也可能耗时，返回后重新核对预算，不能直接接着启动下一次 FETCH。
		if err := ctx.Err(); err != nil {
			return false, batch, err
		}
		if syncShouldYield(ctx) {
			return false, batch, nil
		}
		start = window
		end := min(start+99, last)
		if end < start {
			end = last
		}
		version := s.flagVersion(accountID)
		if budget := bodyBudget(ctx); budget != nil {
			budget.headers++
		}
		messages, err := session.Headers(start, end)
		if err != nil {
			return false, batch, syncStepError("fetch_headers", "", err)
		}
		scanValue := end
		if end == last {
			scanValue = 0
		}
		var scanNext *uint32
		if scan {
			scanNext = &scanValue
		}
		s.flagCommit.Lock()
		if version != s.flagVersion(accountID) {
			s.flagCommit.Unlock()
			// FETCH 期间有用户标记提交，丢弃旧快照并重读该区间；不推进游标，不永久覆盖服务器状态。
			continue
		}
		err = s.store.SaveMailBatch(ctx, accountID, mailboxID, validity, start, end, messages, scanNext)
		s.flagCommit.Unlock()
		if err != nil {
			return false, batch, syncStepError("cache_headers", "", err)
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
		return 0, syncStepError("search", "", err)
	}
	local, localFound, err := s.store.NextCachedUID(ctx, mailboxID, from)
	if err != nil {
		return 0, syncStepError("cache_read", "", err)
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
		domain.ErrTooLarge, domain.ErrOAuthConfig, domain.ErrCredentialMissing, domain.ErrCredentialUnavailable, domain.ErrCredentialInvalid, domain.ErrSendUncertain, domain.ErrActionUnsupported, domain.ErrActionUncertain} {
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
