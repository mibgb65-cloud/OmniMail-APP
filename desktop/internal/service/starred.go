package service

import (
	"context"
	"omnimail/desktop/internal/domain"
)

func (s *Mail) SetStarred(ctx context.Context, id string, starred bool) error {
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
			s.log.Warn("关闭星标连接失败", "code", "NETWORK_FAILED")
		}
	}()
	writer, ok := session.(domain.MailFlagSession)
	if !ok {
		return domain.ErrProtocol
	}
	if err := writer.SetStarred(location.Mailbox, location.UIDValidity, location.UID, starred); err != nil {
		return err
	}
	// 远端确认后才持久化；本地失败如实返回，由下一次同步重验，不虚构跨系统事务。
	s.flagCommit.Lock()
	defer s.flagCommit.Unlock()
	s.mu.Lock()
	s.flagEpoch[location.AccountID]++
	s.mu.Unlock()
	// 服务器已确认写入，即使本地落库失败，也必须使早先 FETCH 的旧快照失效。
	return s.store.UpdateMailStarred(ctx, id, starred)
}
