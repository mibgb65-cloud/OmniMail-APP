package repository

import (
	"context"

	"omnimail/desktop/internal/domain"
)

func (s *Store) UpdateMailRead(ctx context.Context, id string, read bool) error {
	if !domain.ValidAccountID(id) {
		return domain.ErrProtocol
	}
	result, err := s.db.ExecContext(ctx, "UPDATE mail_message SET is_read=? WHERE id=?", read, id)
	if err != nil {
		return storageError("保存已读状态", err)
	}
	count, err := result.RowsAffected()
	if err != nil {
		return storageError("确认已读状态", err)
	}
	if count != 1 {
		return domain.ErrProtocol
	}
	return nil
}

func (s *Store) MoveMail(ctx context.Context, id string, destination domain.RemoteMailbox, validity, uid uint32) (err error) {
	if !domain.ValidAccountID(id) || validity == 0 || uid == 0 ||
		(destination.Kind != "archive" && destination.Kind != "deleted") {
		return domain.ErrProtocol
	}
	location, _, err := s.MailLocation(ctx, id)
	if err != nil {
		return err
	}
	cursor, err := s.PrepareMailbox(ctx, location.AccountID, destination, validity)
	if err != nil {
		return err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return storageError("开始移动邮件", err)
	}
	defer rollback(tx, &err)
	// 同步可能先抓到目标副本，保留原 ID 与已缓存正文/附件，移除重复的目标实例。
	if _, err = tx.ExecContext(ctx, "DELETE FROM mail_message WHERE mailbox_id=? AND uid_validity=? AND uid=? AND id!=?", cursor.ID, validity, uid, id); err != nil {
		return storageError("合并移动实例", err)
	}
	result, err := tx.ExecContext(ctx, "UPDATE mail_message SET mailbox_id=?,uid_validity=?,uid=? WHERE id=?", cursor.ID, validity, uid, id)
	if err != nil {
		return storageError("保存邮件位置", err)
	}
	count, err := result.RowsAffected()
	if err != nil {
		return storageError("确认邮件位置", err)
	}
	if count != 1 {
		return domain.ErrProtocol
	}
	return storageError("提交移动邮件", tx.Commit())
}
