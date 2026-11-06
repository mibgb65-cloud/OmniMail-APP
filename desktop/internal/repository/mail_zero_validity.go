package repository

import (
	"context"
	"database/sql"

	"omnimail/desktop/internal/domain"
)

func allowZeroValidity(ctx context.Context, db interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}, accountID string) error {
	var allowed int
	err := db.QueryRowContext(ctx, `SELECT count(*) FROM account a JOIN account_endpoint e ON a.id=e.account_id
		WHERE a.id=? AND a.provider_code='naver' AND e.protocol='imap'
		AND lower(rtrim(e.host,'.'))='imap.naver.com' AND e.port=993 AND e.tls_mode='implicit_tls'`, accountID).Scan(&allowed)
	if err != nil {
		return storageError("核对零值邮箱边界", err)
	}
	if allowed != 1 {
		return domain.ErrProtocol
	}
	return nil
}

func replaceZeroInstance(ctx context.Context, tx *sql.Tx, mailboxID string, message domain.RemoteMessage) error {
	// 零值无法报告服务器纪元变化。不可变摘要变化时创建新实例，
	// 让旧 ID、正文和附件引用一起失效；标记变化不影响正文身份。
	_, err := tx.ExecContext(ctx, `DELETE FROM mail_message WHERE mailbox_id=? AND uid_validity=0 AND uid=?
		AND (COALESCE(message_id,'')!=? OR subject!=? OR from_addr!=? OR to_addrs!=? OR received_at!=? OR size_bytes!=?)`,
		mailboxID, message.UID, message.MessageID, message.Subject, message.From, message.To, message.ReceivedAt, message.Size)
	return storageError("核对零值邮件实例", err)
}
