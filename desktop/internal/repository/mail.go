package repository

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"strings"
	"unicode"
	"unicode/utf8"

	"omnimail/desktop/internal/domain"
)

type MailboxCursor = domain.MailboxCursor

func (s *Store) PrepareMailbox(ctx context.Context, accountID string, box domain.RemoteMailbox,
	validity uint32) (cursor MailboxCursor, err error) {
	if !domain.ValidAccountID(accountID) || validity == 0 || len(box.Name) == 0 || len(box.Name) > 1024 ||
		!utf8.ValidString(box.Name) || strings.ContainsFunc(box.Name, unicode.IsControl) {
		return cursor, domain.ErrProtocol
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return cursor, storageError("开始文件夹事务", err)
	}
	defer rollback(tx, &err)
	var old uint32
	err = tx.QueryRowContext(ctx, "SELECT id, uid_validity, last_uid, scan_uid FROM mailbox WHERE account_id=? AND remote_name=?",
		accountID, box.Name).Scan(&cursor.ID, &old, &cursor.LastUID, &cursor.ScanUID)
	if errors.Is(err, sql.ErrNoRows) {
		cursor.ID = rand.Text()
		_, err = tx.ExecContext(ctx, "INSERT INTO mailbox(id,account_id,remote_name,kind,uid_validity) VALUES(?,?,?,?,?)",
			cursor.ID, accountID, box.Name, box.Kind, validity)
	} else if err == nil {
		if old != validity {
			_, err = tx.ExecContext(ctx, "DELETE FROM mail_message WHERE mailbox_id=?", cursor.ID)
			if err == nil {
				_, err = tx.ExecContext(ctx, "UPDATE mailbox SET uid_validity=?,last_uid=0,scan_uid=0 WHERE id=?", validity, cursor.ID)
			}
			cursor.LastUID, cursor.ScanUID = 0, 0
		}
		if err == nil {
			_, err = tx.ExecContext(ctx, "UPDATE mailbox SET kind=? WHERE id=?", box.Kind, cursor.ID)
		}
	}
	if err != nil {
		return cursor, storageError("保存文件夹", err)
	}
	return cursor, storageError("提交文件夹", tx.Commit())
}

func (s *Store) SaveMailBatch(ctx context.Context, accountID, mailboxID string, validity, start, end uint32,
	messages []domain.RemoteMessage, scanNext *uint32) (err error) {
	if !domain.ValidAccountID(accountID) || !domain.ValidAccountID(mailboxID) || validity == 0 ||
		start == 0 || end < start || end-start >= 100 || len(messages) > 100 {
		return domain.ErrProtocol
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return storageError("开始邮件批次", err)
	}
	defer rollback(tx, &err)
	var actual uint32
	if err := tx.QueryRowContext(ctx, "SELECT uid_validity FROM mailbox WHERE id=? AND account_id=?", mailboxID, accountID).Scan(&actual); err != nil || actual != validity {
		return domain.ErrProtocol
	}
	kept := map[uint32]bool{}
	for _, message := range messages {
		if message.UID < start || message.UID > end || kept[message.UID] ||
			len(message.Subject) > 4096 || len(message.MessageID) > 998 || len(message.From) > 4096 || len(message.To) > 4096 {
			return domain.ErrProtocol
		}
		kept[message.UID] = true
		_, err = tx.ExecContext(ctx, `INSERT INTO mail_message
			(id,account_id,mailbox_id,uid_validity,uid,message_id,subject,from_addr,to_addrs,received_at,is_read,is_starred,size_bytes)
			VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(mailbox_id,uid_validity,uid) DO UPDATE SET
			subject=excluded.subject,from_addr=excluded.from_addr,to_addrs=excluded.to_addrs,
			received_at=excluded.received_at,is_read=excluded.is_read,is_starred=excluded.is_starred,size_bytes=excluded.size_bytes`,
			rand.Text(), accountID, mailboxID, validity, message.UID, nullableReference(message.MessageID), message.Subject,
			message.From, message.To, message.ReceivedAt, message.Read, message.Starred, message.Size)
		if err != nil {
			return storageError("保存邮件头", err)
		}
	}
	// 只在 FETCH 整批成功后核对该区间；遗漏 UID 表示已从服务器移除，不删除区间外的邮件。
	deleteSQL := "DELETE FROM mail_message WHERE mailbox_id=? AND uid_validity=? AND uid BETWEEN ? AND ?"
	arguments := []any{mailboxID, validity, start, end}
	if len(messages) > 0 {
		deleteSQL += " AND uid NOT IN (" + strings.TrimSuffix(strings.Repeat("?,", len(messages)), ",") + ")"
		for _, message := range messages {
			arguments = append(arguments, message.UID)
		}
	}
	if _, err := tx.ExecContext(ctx, deleteSQL, arguments...); err != nil {
		return storageError("核对远端实例", err)
	}
	if _, err := tx.ExecContext(ctx, "UPDATE mailbox SET last_uid=max(last_uid,?) WHERE id=?", end, mailboxID); err != nil {
		return storageError("保存同步进度", err)
	}
	if scanNext != nil {
		if _, err := tx.ExecContext(ctx, "UPDATE mailbox SET scan_uid=? WHERE id=?", *scanNext, mailboxID); err != nil {
			return storageError("保存核对进度", err)
		}
	}
	return storageError("提交邮件批次", tx.Commit())
}

func (s *Store) NextCachedUID(ctx context.Context, mailboxID string, from uint32) (uint32, bool, error) {
	if !domain.ValidAccountID(mailboxID) || from == 0 {
		return 0, false, domain.ErrProtocol
	}
	var value sql.NullInt64
	if err := s.db.QueryRowContext(ctx, "SELECT min(uid) FROM mail_message WHERE mailbox_id=? AND uid>=?", mailboxID, from).Scan(&value); err != nil {
		return 0, false, storageError("读取下一本地 UID", err)
	}
	return uint32(value.Int64), value.Valid, nil
}

func (s *Store) PageMail(ctx context.Context, accountID, folder string, offset int) (result []domain.MailSummary, err error) {
	if (accountID != "" && !domain.ValidAccountID(accountID)) || offset < 0 || offset > 1000000 {
		return nil, domain.ErrInvalidAccount
	}
	switch folder {
	case "inbox", "sent", "drafts", "archive", "deleted", "starred":
	default:
		return nil, domain.ErrProtocol
	}
	rows, err := s.db.QueryContext(ctx, `SELECT m.id,m.account_id,b.remote_name,m.subject,m.from_addr,m.to_addrs,
		m.received_at,m.is_read,m.is_starred,m.body_text IS NOT NULL FROM mail_message m
		JOIN mailbox b ON b.id=m.mailbox_id JOIN account a ON a.id=m.account_id
		WHERE (?='' OR m.account_id=?) AND (a.status!='disconnected' OR ?!='')
		AND ((?='starred' AND m.is_starred=1) OR (?!='starred' AND b.kind=?))
		ORDER BY m.received_at DESC,m.id DESC LIMIT 100 OFFSET ?`, accountID, accountID, accountID, folder, folder, folder, offset)
	if err != nil {
		return nil, storageError("读取邮件列表", err)
	}
	defer func() { err = joinClose(err, rows.Close()) }()
	result = []domain.MailSummary{}
	for rows.Next() {
		var message domain.MailSummary
		if err := rows.Scan(&message.ID, &message.AccountID, &message.Mailbox, &message.Subject, &message.From, &message.To,
			&message.ReceivedAt, &message.Read, &message.Starred, &message.Cached); err != nil {
			return nil, storageError("解析邮件列表", err)
		}
		result = append(result, message)
	}
	return result, storageError("读取邮件列表", rows.Err())
}

func (s *Store) MailLocation(ctx context.Context, id string) (location domain.MailLocation, size uint32, err error) {
	if !domain.ValidAccountID(id) {
		return location, 0, domain.ErrProtocol
	}
	err = s.db.QueryRowContext(ctx, `SELECT m.account_id,b.remote_name,m.uid_validity,m.uid,m.size_bytes
		FROM mail_message m JOIN mailbox b ON b.id=m.mailbox_id WHERE m.id=?`, id).
		Scan(&location.AccountID, &location.Mailbox, &location.UIDValidity, &location.UID, &size)
	return location, size, storageError("读取远端邮件位置", err)
}

func (s *Store) ReadMail(ctx context.Context, id string) (detail domain.MailDetail, err error) {
	if !domain.ValidAccountID(id) {
		return detail, domain.ErrProtocol
	}
	err = s.db.QueryRowContext(ctx, `SELECT m.id,m.account_id,b.remote_name,m.subject,m.from_addr,m.to_addrs,
		m.received_at,m.is_read,m.is_starred,m.body_text IS NOT NULL,COALESCE(m.body_text,'')
		FROM mail_message m JOIN mailbox b ON b.id=m.mailbox_id WHERE m.id=?`, id).
		Scan(&detail.ID, &detail.AccountID, &detail.Mailbox, &detail.Subject, &detail.From, &detail.To,
			&detail.ReceivedAt, &detail.Read, &detail.Starred, &detail.Cached, &detail.Body)
	if err != nil {
		return detail, storageError("读取邮件正文", err)
	}
	rows, err := s.db.QueryContext(ctx, "SELECT id,filename,mime,size_bytes FROM mail_attachment WHERE mail_id=? ORDER BY rowid", id)
	if err != nil {
		return detail, storageError("读取附件信息", err)
	}
	defer func() { err = joinClose(err, rows.Close()) }()
	detail.Attachments = []domain.AttachmentInfo{}
	for rows.Next() {
		var attachment domain.AttachmentInfo
		if err := rows.Scan(&attachment.ID, &attachment.Filename, &attachment.MIME, &attachment.Size); err != nil {
			return detail, storageError("解析附件信息", err)
		}
		detail.Attachments = append(detail.Attachments, attachment)
	}
	return detail, storageError("读取附件信息", rows.Err())
}
