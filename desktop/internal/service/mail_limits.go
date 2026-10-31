package service

import (
	"context"
	"errors"

	"omnimail/desktop/internal/domain"
)

var errBodyCleanup = errors.New("STORAGE_FAILED")

func (s *Mail) limitedMessage(ctx context.Context, id string, cause error) (domain.MailDetail, error) {
	if ctx.Err() != nil {
		return domain.MailDetail{}, ctx.Err()
	}
	code := domain.MessageLimitCode(cause)
	if code == "" {
		return domain.MailDetail{}, cause
	}
	if err := s.store.MarkMailBodyLimit(ctx, id, code); err != nil {
		return domain.MailDetail{}, err
	}
	return s.store.ReadMail(ctx, id)
}

func (s *Mail) logSyncCompletion(ctx context.Context, id, provider string) {
	counts, err := s.store.MailLimitCounts(ctx)
	if err != nil {
		s.log.Warn("读取同步完成状态失败", "code", ErrorCode(err), "provider", safeSyncProvider(provider))
		return
	}
	if counts[id] > 0 {
		s.log.Info("可处理邮件已同步，存在未完整下载邮件", "code", "SYNC_LIMITED", "provider", safeSyncProvider(provider))
		return
	}
	s.log.Info("邮件同步周期完成", "code", "SYNC_COMPLETE", "provider", safeSyncProvider(provider))
}
