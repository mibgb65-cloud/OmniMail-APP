package repository

import (
	"context"

	"omnimail/desktop/internal/domain"
)

func (s *Store) PendingMailBodies(ctx context.Context, accountID, mailboxID string, validity uint32, limit int) (result []domain.MailBodyTarget, err error) {
	if !domain.ValidAccountID(accountID) || !domain.ValidAccountID(mailboxID) ||
		validity == 0 || limit < 1 || limit > 100 {
		return nil, domain.ErrProtocol
	}
	// 正文是否完整以数据库提交结果为准，不依赖进程内队列；旧版纯文本也需要补齐到当前版本。
	rows, err := s.db.QueryContext(ctx, `SELECT m.id,m.uid,m.size_bytes
		FROM mail_message m JOIN mailbox b ON b.id=m.mailbox_id
		WHERE m.account_id=? AND m.mailbox_id=? AND m.uid_validity=? AND b.uid_validity=?
		AND (m.body_text IS NULL OR m.body_version<1)
		ORDER BY m.uid DESC LIMIT ?`, accountID, mailboxID, validity, validity, limit)
	if err != nil {
		return nil, storageError("读取待补正文", err)
	}
	defer func() { err = joinClose(err, rows.Close()) }()
	result = []domain.MailBodyTarget{}
	for rows.Next() {
		var target domain.MailBodyTarget
		if err := rows.Scan(&target.ID, &target.UID, &target.Size); err != nil {
			return nil, storageError("解析待补正文", err)
		}
		result = append(result, target)
	}
	return result, storageError("读取待补正文", rows.Err())
}
