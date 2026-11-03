package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"omnimail/desktop/internal/domain"
)

func taskSourceGuard(ctx context.Context, tx *sql.Tx, run string, mail domain.TaskMail) (domain.TaskPreferences, error) {
	p, err := readTaskPreferences(ctx, tx)
	if err != nil {
		return p, err
	}
	var revision, kind, state string
	if tx.QueryRowContext(ctx, "SELECT prefs_revision,kind,state FROM task_run WHERE id=?", run).Scan(&revision, &kind, &state) != nil {
		return p, domain.ErrTaskNotFound
	}
	if !p.Consent || p.Revision != revision || state != "running" || !p.Allows(mail.AccountID, mail.Folder) || (kind == "daily" && !p.Enabled) {
		return p, domain.ErrTaskConsent
	}
	var bodyRevision int
	var account, folder, status string
	var ready, enabled bool
	if tx.QueryRowContext(ctx, `SELECT m.ai_body_revision,m.account_id,b.kind,a.status,a.sync_enabled,
		(m.body_version>=1 AND m.body_error_code='' AND m.body_text IS NOT NULL)
		FROM mail_message m JOIN mailbox b ON b.id=m.mailbox_id JOIN account a ON a.id=m.account_id WHERE m.id=?`, mail.ID).
		Scan(&bodyRevision, &account, &folder, &status, &enabled, &ready) != nil {
		return p, domain.ErrTaskNotFound
	}
	if bodyRevision != mail.BodyRevision || account != mail.AccountID || folder != mail.Folder || !ready {
		return p, domain.ErrTaskConflict
	}
	if kind == "daily" && (status != "configured" || !enabled) {
		return p, domain.ErrTaskConsent
	}
	return p, nil
}

func markTaskLedger(ctx context.Context, tx *sql.Tx, mail domain.TaskMail, fingerprint, state string) error {
	if _, err := tx.ExecContext(ctx, `INSERT INTO task_mail_ledger(mail_id,body_revision,fingerprint,state) VALUES(?,?,?,?)
		ON CONFLICT(mail_id) DO UPDATE SET body_revision=excluded.body_revision,fingerprint=excluded.fingerprint,state=excluded.state`,
		mail.ID, mail.BodyRevision, fingerprint, state); err != nil {
		return domain.ErrTaskStorage
	}
	return nil
}

func (s *Store) ReserveTaskMail(ctx context.Context, run string, mail domain.TaskMail, fingerprint string, retry bool) (call bool, err error) {
	if !domain.ValidAccountID(run) || !domain.ValidAccountID(mail.ID) || !contentHash.MatchString(fingerprint) {
		return false, domain.ErrTaskInput
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return false, domain.ErrTaskStorage
	}
	defer rollback(tx, &err)
	if _, err := taskSourceGuard(ctx, tx, run, mail); err != nil {
		return false, err
	}
	var state string
	err = tx.QueryRowContext(ctx, "SELECT state FROM task_receipt WHERE fingerprint=? AND account_id=?", fingerprint, mail.AccountID).Scan(&state)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return false, domain.ErrTaskStorage
	}
	if state == "success" || (state == "unknown" && !retry) {
		if err := markTaskLedger(ctx, tx, mail, fingerprint, state); err != nil {
			return false, err
		}
		mailState, code := "skipped", ""
		if state == "unknown" {
			mailState, code = "unknown", domain.ErrTaskUnknown.Error()
		}
		if _, err = tx.ExecContext(ctx, "UPDATE task_run_mail SET state=?,error=? WHERE run_id=? AND mail_id=? AND state='queued'", mailState, code, run, mail.ID); err != nil {
			return false, domain.ErrTaskStorage
		}
		if tx.Commit() != nil {
			return false, domain.ErrTaskStorage
		}
		if state == "unknown" {
			return false, domain.ErrTaskUnknown
		}
		return false, nil
	}
	var count int
	if tx.QueryRowContext(ctx, "SELECT count(*) FROM todo_item").Scan(&count) != nil {
		return false, domain.ErrTaskStorage
	}
	if count > 9988 {
		return false, domain.ErrTaskLimit
	}
	// 请求前先登记结果未知。崩溃不能把可能已经计费的请求当作从未发送。
	if _, err = tx.ExecContext(ctx, `INSERT INTO task_receipt(fingerprint,account_id,state,run_id,created_at) VALUES(?,?,'unknown',?,?)
		ON CONFLICT(fingerprint) DO UPDATE SET run_id=excluded.run_id,created_at=excluded.created_at WHERE task_receipt.state='unknown'`,
		fingerprint, mail.AccountID, run, time.Now().UnixMilli()); err != nil {
		return false, domain.ErrTaskStorage
	}
	if err := markTaskLedger(ctx, tx, mail, fingerprint, "unknown"); err != nil {
		return false, err
	}
	result, err := tx.ExecContext(ctx, "UPDATE task_run_mail SET state='processing',error='' WHERE run_id=? AND mail_id=? AND state='queued'", run, mail.ID)
	if err != nil {
		return false, domain.ErrTaskStorage
	}
	if n, err := result.RowsAffected(); err != nil || n != 1 {
		return false, domain.ErrTaskConflict
	}
	if tx.Commit() != nil {
		return false, domain.ErrTaskStorage
	}
	return true, nil
}
