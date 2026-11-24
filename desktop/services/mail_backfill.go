package services

import (
	"context"
	"strings"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/syncer"
)

// LoadOlderMessages 按需向远端 IMAP 服务器回溯拉取指定账号与文件夹下更早的历史邮件。
func (s *MailService) LoadOlderMessages(accountID string, folder string, limit int) (syncer.LoadOlderResult, error) {
	if _, err := s.mgr.ActiveSession(); err != nil {
		return syncer.LoadOlderResult{}, err
	}
	if s.syncer == nil {
		return syncer.LoadOlderResult{}, apperr.New(apperr.CodeInternal, "邮件同步服务尚未初始化")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	return s.syncer.LoadOlderMessages(ctx, strings.TrimSpace(accountID), strings.TrimSpace(folder), limit)
}
