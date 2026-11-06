package repository

import (
	"context"

	"omnimail/desktop/internal/domain"
)

func (s *Store) MarkMailBodyLimit(ctx context.Context, id, code string) error {
	if !domain.ValidAccountID(id) {
		return domain.ErrProtocol
	}
	switch code {
	case "MESSAGE_RAW_TOO_LARGE", "ATTACHMENT_TOO_LARGE", "MESSAGE_TEXT_TOO_LARGE", "MESSAGE_PARTS_TOO_MANY":
	default:
		return domain.ErrProtocol
	}
	// 只记录结果，不清除旧正文、附件或已读/星标。成功保存正文时在同一事务内清除。
	result, err := s.db.ExecContext(ctx, "UPDATE mail_message SET body_error_code=? WHERE id=?", code, id)
	if err != nil {
		return storageError("记录单封读取限制", err)
	}
	count, err := result.RowsAffected()
	if err != nil {
		return storageError("确认读取限制记录", err)
	}
	if count != 1 {
		return domain.ErrProtocol
	}
	return nil
}

func (s *Store) MailLimitCounts(ctx context.Context) (map[string]int, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT account_id,COUNT(*) FROM mail_message WHERE body_error_code<>'' GROUP BY account_id")
	if err != nil {
		return nil, storageError("统计未完整下载邮件", err)
	}
	defer rows.Close()
	result := make(map[string]int)
	for rows.Next() {
		var id string
		var count int
		if err := rows.Scan(&id, &count); err != nil {
			return nil, storageError("读取受限邮件计数", err)
		}
		result[id] = count
	}
	if err := rows.Err(); err != nil {
		return nil, storageError("遍历受限邮件计数", err)
	}
	return result, nil
}
