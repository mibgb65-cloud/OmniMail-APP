package repository

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"time"

	"omnimail/desktop/internal/domain"
)

const taskRunColumns = `r.id,r.kind,r.state,coalesce(r.slot,''),r.prefs_revision,r.started_at,r.finished_at,
	(SELECT count(*) FROM task_run_mail m WHERE m.run_id=r.id),
	(SELECT count(*) FROM task_run_mail m WHERE m.run_id=r.id AND m.state IN ('done','skipped')),
	(SELECT count(*) FROM task_run_mail m WHERE m.run_id=r.id AND m.state='failed'),
	(SELECT count(*) FROM task_run_mail m WHERE m.run_id=r.id AND m.state='unknown'),
	(SELECT count(*) FROM task_run_mail m WHERE m.run_id=r.id AND m.state='queued'),
	r.waiting_body,r.remaining,r.error,r.retry_unknown,r.new_count,r.change_count,r.needs_sync`

func scanTaskRun(row todoScanner) (v domain.TaskRun, err error) {
	err = row.Scan(&v.ID, &v.Kind, &v.State, &v.Slot, &v.PrefsRevision, &v.StartedAt, &v.FinishedAt, &v.Total, &v.Done,
		&v.Failed, &v.Unknown, &v.Pending, &v.WaitingBody, &v.Remaining, &v.Error, &v.RetryUnknown, &v.NewTodos, &v.Changes, &v.SyncPending)
	if errors.Is(err, sql.ErrNoRows) {
		return v, domain.ErrTaskNotFound
	}
	if err != nil {
		return v, domain.ErrTaskStorage
	}
	return v, nil
}

func (s *Store) CreateTaskRun(ctx context.Context, kind, slot, revision string, ids []string, retry bool, waiting, remaining int) (value domain.TaskRun, created bool, err error) {
	if (kind != "manual" && kind != "daily") || !domain.ValidAccountID(revision) || len(ids) > 100 ||
		!domain.TaskText(slot, 128, false) || waiting < 0 || remaining < 0 {
		return value, false, domain.ErrTaskInput
	}
	seen := map[string]bool{}
	for _, id := range ids {
		if !domain.ValidAccountID(id) || seen[id] {
			return value, false, domain.ErrTaskInput
		}
		seen[id] = true
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return value, false, domain.ErrTaskStorage
	}
	defer rollback(tx, &err)
	if slot != "" {
		value, err = scanTaskRun(tx.QueryRowContext(ctx, "SELECT "+taskRunColumns+" FROM task_run r WHERE r.slot=?", slot))
		if err == nil {
			return value, false, nil
		}
		if !errors.Is(err, domain.ErrTaskNotFound) {
			return value, false, err
		}
	}
	value.ID = rand.Text()
	if _, err = tx.ExecContext(ctx, `INSERT INTO task_run(id,kind,state,slot,prefs_revision,retry_unknown,started_at,waiting_body,remaining,needs_sync)
		VALUES(?,?,'running',?,?,?,?,?,?,?)`, value.ID, kind, nullableReference(slot), revision, retry, time.Now().UnixMilli(), waiting, remaining, kind == "daily" || len(ids) == 0); err != nil {
		return value, false, domain.ErrTaskStorage
	}
	for _, id := range ids {
		var subject string
		if tx.QueryRowContext(ctx, "SELECT subject FROM mail_message WHERE id=?", id).Scan(&subject) != nil {
			return value, false, domain.ErrTaskNotFound
		}
		if _, err = tx.ExecContext(ctx, "INSERT INTO task_run_mail(run_id,mail_id,subject) VALUES(?,?,?)", value.ID, id, subject); err != nil {
			return value, false, domain.ErrTaskStorage
		}
	}
	value, err = scanTaskRun(tx.QueryRowContext(ctx, "SELECT "+taskRunColumns+" FROM task_run r WHERE r.id=?", value.ID))
	if err != nil {
		return value, false, err
	}
	if tx.Commit() != nil {
		return value, false, domain.ErrTaskStorage
	}
	return value, true, nil
}

func (s *Store) TaskRuns(ctx context.Context) ([]domain.TaskRun, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT "+taskRunColumns+" FROM task_run r ORDER BY r.started_at DESC,r.id DESC LIMIT 20")
	if err != nil {
		return nil, domain.ErrTaskStorage
	}
	defer rows.Close()
	result := []domain.TaskRun{}
	for rows.Next() {
		v, err := scanTaskRun(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, v)
	}
	if rows.Err() != nil {
		return nil, domain.ErrTaskStorage
	}
	return result, nil
}

func (s *Store) ResumableTaskRun(ctx context.Context, revision string, daily bool) (*domain.TaskRun, error) {
	if !domain.ValidAccountID(revision) {
		return nil, domain.ErrTaskInput
	}
	value, err := scanTaskRun(s.db.QueryRowContext(ctx, "SELECT "+taskRunColumns+` FROM task_run r
		WHERE r.prefs_revision=? AND r.state IN ('running','interrupted') AND (r.kind='manual' OR ?)
		AND (r.needs_sync=1 OR EXISTS(SELECT 1 FROM task_run_mail m WHERE m.run_id=r.id AND m.state='queued'))
		ORDER BY r.started_at,r.id LIMIT 1`, revision, daily))
	if errors.Is(err, domain.ErrTaskNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &value, nil
}

func (s *Store) TaskRunDetails(ctx context.Context, id string) (domain.TaskRunDetails, error) {
	value := domain.TaskRunDetails{Mails: []domain.TaskRunMail{}}
	if !domain.ValidAccountID(id) {
		return value, domain.ErrTaskInput
	}
	run, err := scanTaskRun(s.db.QueryRowContext(ctx, "SELECT "+taskRunColumns+" FROM task_run r WHERE r.id=?", id))
	if err != nil {
		return value, err
	}
	value.Run = run
	rows, err := s.db.QueryContext(ctx, "SELECT mail_id,subject,state,error FROM task_run_mail WHERE run_id=? ORDER BY rowid LIMIT 100", id)
	if err != nil {
		return value, domain.ErrTaskStorage
	}
	defer rows.Close()
	for rows.Next() {
		var mail domain.TaskRunMail
		if rows.Scan(&mail.MailID, &mail.Subject, &mail.State, &mail.Error) != nil {
			return value, domain.ErrTaskStorage
		}
		value.Mails = append(value.Mails, mail)
	}
	if rows.Err() != nil {
		return value, domain.ErrTaskStorage
	}
	return value, nil
}

func (s *Store) NextTaskMail(ctx context.Context, id string) (domain.TaskRunMail, bool, error) {
	var value domain.TaskRunMail
	err := s.db.QueryRowContext(ctx, "SELECT mail_id,subject,state,error FROM task_run_mail WHERE run_id=? AND state='queued' ORDER BY rowid LIMIT 1", id).
		Scan(&value.MailID, &value.Subject, &value.State, &value.Error)
	if errors.Is(err, sql.ErrNoRows) {
		return value, false, nil
	}
	if err != nil {
		return value, false, domain.ErrTaskStorage
	}
	return value, true, nil
}

func (s *Store) FailTaskMail(ctx context.Context, run, id, code string, attempted bool) error {
	if !domain.ValidAccountID(run) || !domain.ValidAccountID(id) || !domain.TaskText(code, 80, false) {
		return domain.ErrTaskInput
	}
	state := "failed"
	if attempted {
		state = "unknown"
	}
	if _, err := s.db.ExecContext(ctx, "UPDATE task_run_mail SET state=?,error=? WHERE run_id=? AND mail_id=? AND state IN ('queued','processing')", state, code, run, id); err != nil {
		return domain.ErrTaskStorage
	}
	if !attempted && (code == "AI_TOO_LARGE" || code == "AI_BODY_NOT_READY") {
		if _, err := s.db.ExecContext(ctx, `INSERT INTO task_mail_ledger(mail_id,body_revision,fingerprint,state)
			SELECT id,ai_body_revision,lower(hex(zeroblob(32))),'blocked' FROM mail_message WHERE id=?
			ON CONFLICT(mail_id) DO UPDATE SET body_revision=excluded.body_revision,fingerprint=excluded.fingerprint,state='blocked'`, id); err != nil {
			return domain.ErrTaskStorage
		}
	}
	return nil
}
func (s *Store) FinishTaskRun(ctx context.Context, id, state, code string) error {
	if !domain.ValidAccountID(id) || !domain.TaskText(code, 80, false) {
		return domain.ErrTaskInput
	}
	switch state {
	case "success", "partial", "failed", "cancelled", "interrupted":
	default:
		return domain.ErrTaskInput
	}
	if _, err := s.db.ExecContext(ctx, "UPDATE task_run SET state=?,error=?,finished_at=? WHERE id=?", state, code, time.Now().UnixMilli(), id); err != nil {
		return domain.ErrTaskStorage
	}
	return nil
}
func (s *Store) MarkTaskRunning(ctx context.Context, id string) error {
	if !domain.ValidAccountID(id) {
		return domain.ErrTaskInput
	}
	if _, err := s.db.ExecContext(ctx, "UPDATE task_run SET state='running',finished_at=0,error='' WHERE id=?", id); err != nil {
		return domain.ErrTaskStorage
	}
	return nil
}
func (s *Store) RecoverTaskRuns(ctx context.Context) (err error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.ErrTaskStorage
	}
	defer rollback(tx, &err)
	if _, err = tx.ExecContext(ctx, "UPDATE task_run_mail SET state='unknown',error='TASK_OUTCOME_UNKNOWN' WHERE state='processing'"); err != nil {
		return domain.ErrTaskStorage
	}
	if _, err = tx.ExecContext(ctx, "UPDATE task_run SET state='interrupted',finished_at=? WHERE state='running'", time.Now().UnixMilli()); err != nil {
		return domain.ErrTaskStorage
	}
	if tx.Commit() != nil {
		return domain.ErrTaskStorage
	}
	return nil
}
