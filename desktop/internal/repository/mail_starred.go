package repository

import (
	"context"
	"omnimail/desktop/internal/domain"
)

func (s *Store) UpdateMailStarred(ctx context.Context, id string, starred bool) error {
	if !domain.ValidAccountID(id) {
		return domain.ErrProtocol
	}
	result, err := s.db.ExecContext(ctx, "UPDATE mail_message SET is_starred=? WHERE id=?", starred, id)
	if err != nil {
		return storageError("保存邮件星标", err)
	}
	count, err := result.RowsAffected()
	if err != nil {
		return storageError("核对星标保存", err)
	}
	if count != 1 {
		return domain.ErrProtocol
	}
	return nil
}
