package service

import (
	"context"
	"omnimail/desktop/internal/domain"
)

func (s *Mail) SetStarred(ctx context.Context, id string, starred bool) error {
	return s.writeMessage(ctx, id, func(session domain.MailSession, location domain.MailLocation) error {
		writer, ok := session.(domain.MailFlagSession)
		if !ok {
			return domain.ErrProtocol
		}
		return writer.SetStarred(location.Mailbox, location.UIDValidity, location.UID, starred)
	}, func(ctx context.Context) error { return s.store.UpdateMailStarred(ctx, id, starred) }, false)
}

func (s *Mail) writeMessage(ctx context.Context, id string,
	remote func(domain.MailSession, domain.MailLocation) error, persist func(context.Context) error, guardMove bool) error {
	ctx, done, err := s.request(ctx)
	if err != nil {
		return err
	}
	defer done()
	location, _, err := s.store.MailLocation(ctx, id)
	if err != nil {
		return err
	}
	release, err := s.acquireForeground(ctx, location.AccountID, true)
	if err != nil {
		return err
	}
	defer release()
	// 排队期间邮件可能已被另一个写操作移动，必须重新取远端位置。
	location, _, err = s.store.MailLocation(ctx, id)
	if err != nil {
		return err
	}
	account, err := s.store.GetAccount(ctx, location.AccountID)
	if err != nil {
		return err
	}
	if account.Status == domain.AccountDisconnected {
		return domain.ErrCredentialMissing
	}
	connection, err := endpoint(account, domain.ProtocolIMAP)
	if err != nil {
		return err
	}
	secret, err := s.secrets.Get(ctx, connection.CredentialRef)
	if err != nil {
		return err
	}
	defer clear(secret)
	session, err := s.transport.Connect(ctx, connection, secret)
	if err != nil {
		return err
	}
	defer func() {
		if err := session.Close(); err != nil && ctx.Err() == nil {
			s.log.Warn("关闭邮件操作连接失败", "code", "NETWORK_FAILED")
		}
	}()
	// MOVE 会让源 UID 消失；在远端移动与本地位置提交之间阻止后台删除源缓存。
	// 普通标记仍只在短提交窗口持锁，不使慢星标/已读网络请求阻塞后台落库。
	if guardMove {
		s.flagCommit.Lock()
	}
	remoteErr := remote(session, location)
	// 远端确认后才持久化；本地失败如实返回，由下一次同步重验，不虚构跨系统事务。
	if !guardMove {
		s.flagCommit.Lock()
	}
	defer s.flagCommit.Unlock()
	s.mu.Lock()
	s.flagEpoch[location.AccountID]++
	s.mu.Unlock()
	// 服务器已确认写入，即使本地落库失败，也必须使早先 FETCH 的旧快照失效。
	if remoteErr != nil {
		return remoteErr
	}
	err = persist(ctx)
	if guardMove && err != nil {
		// 远端已移动而落库失败，不把它描述成安全可重试的普通存储错误。
		return domain.ErrActionUncertain
	}
	return err
}
