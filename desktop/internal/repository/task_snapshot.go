package repository

import (
	"context"

	"omnimail/desktop/internal/domain"
)

func (s *Store) FillTaskRun(ctx context.Context, id string, ids []string, waiting, remaining int, incomplete bool) (err error) {
	if !domain.ValidAccountID(id) || len(ids) > 100 || waiting < 0 || remaining < 0 {
		return domain.ErrTaskInput
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.ErrTaskStorage
	}
	defer rollback(tx, &err)
	p, err := readTaskPreferences(ctx, tx)
	if err != nil {
		return err
	}
	var revision, state string
	var needs bool
	if tx.QueryRowContext(ctx, "SELECT prefs_revision,state,needs_sync FROM task_run WHERE id=?", id).Scan(&revision, &state, &needs) != nil {
		return domain.ErrTaskNotFound
	}
	if revision != p.Revision || !p.Consent || state != "running" || !needs {
		return domain.ErrTaskConflict
	}
	for _, mailID := range ids {
		if !domain.ValidAccountID(mailID) {
			return domain.ErrTaskInput
		}
		var subject string
		if tx.QueryRowContext(ctx, "SELECT subject FROM mail_message WHERE id=?", mailID).Scan(&subject) != nil {
			return domain.ErrTaskNotFound
		}
		if _, err = tx.ExecContext(ctx, "INSERT INTO task_run_mail(run_id,mail_id,subject) VALUES(?,?,?)", id, mailID, subject); err != nil {
			return domain.ErrTaskStorage
		}
	}
	code := ""
	if incomplete {
		code = "TASK_SYNC_INCOMPLETE"
	}
	if _, err = tx.ExecContext(ctx, "UPDATE task_run SET needs_sync=0,waiting_body=?,remaining=?,error=? WHERE id=?", waiting, remaining, code, id); err != nil {
		return domain.ErrTaskStorage
	}
	if tx.Commit() != nil {
		return domain.ErrTaskStorage
	}
	return nil
}
