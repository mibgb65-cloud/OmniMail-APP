package service

import (
	"context"

	"omnimail/desktop/internal/domain"
)

func confirmedZeroValidity(session domain.MailSession) bool {
	confirmed, ok := session.(domain.MailZeroValiditySession)
	return ok && confirmed.ZeroUIDValidity()
}

func (s *Mail) syncZeroMailbox(ctx context.Context, accountID string, cursor domain.MailboxCursor, next uint32,
	session domain.MailSession) (bool, error) {
	// 无可靠纪元时不依赖高水位增量：分批轮转核对全部摘要，给正文校验预留网络预算。
	last := max(next-1, cursor.LastUID)
	start := cursor.ScanUID + 1
	if start == 0 || start > last {
		start = 1
	}
	finished, _, err := s.syncPass(ctx, accountID, cursor.ID, 0, start, last, 2, true, session)
	if err != nil {
		return true, err
	}
	pending, _, err := s.syncStoredBodies(ctx, accountID, cursor.ID, 0, session)
	return !finished || pending, err
}

func zeroHeaders(ctx context.Context, session domain.MailSession, uid uint32) ([]domain.RemoteMessage, error) {
	if !confirmedZeroValidity(session) {
		return nil, domain.ErrProtocol
	}
	if budget := bodyBudget(ctx); budget != nil {
		budget.headers++
	}
	messages, err := session.Headers(uid, uid)
	if err != nil {
		return nil, err
	}
	if len(messages) > 1 || (len(messages) == 1 && messages[0].UID != uid) {
		return nil, domain.ErrProtocol
	}
	return messages, nil
}

func verifyZeroIdentity(ctx context.Context, session domain.MailSession, location domain.MailLocation) error {
	messages, err := zeroHeaders(ctx, session, location.UID)
	if err != nil {
		return err
	}
	if len(messages) != 1 || !location.Identity.SameIdentity(messages[0]) {
		return domain.ErrProtocol
	}
	return nil
}

func (s *Mail) reconcileZeroBody(ctx context.Context, accountID, mailboxID string, target domain.MailBodyTarget,
	session domain.MailSession) (bool, error) {
	location, _, err := s.store.MailLocation(ctx, target.ID)
	if err != nil {
		return false, err
	}
	messages, err := zeroHeaders(ctx, session, target.UID)
	if err != nil {
		return false, err
	}
	if err := s.store.SaveMailBatch(ctx, accountID, mailboxID, 0, target.UID, target.UID, messages, nil); err != nil {
		return false, err
	}
	// UID 已重用时旧 ID 已被事务替换；留到下一轮下载新实例，不把新正文写到旧 ID。
	return len(messages) == 1 && location.Identity.SameIdentity(messages[0]), nil
}
