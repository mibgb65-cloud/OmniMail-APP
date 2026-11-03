package repository

import (
	"context"
	"crypto/rand"
	"time"

	"omnimail/desktop/internal/domain"
)

func (s *Store) CommitRequirements(ctx context.Context, run string, mail domain.TaskMail, fingerprint string, input domain.RequirementInput, output domain.RequirementOutput) (err error) {
	if !contentHash.MatchString(fingerprint) || output.Validate(input) != nil {
		return domain.ErrTaskInput
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.ErrTaskStorage
	}
	defer rollback(tx, &err)
	p, err := taskSourceGuard(ctx, tx, run, mail)
	if err != nil {
		return err
	}
	var owner, state string
	if tx.QueryRowContext(ctx, "SELECT run_id,state FROM task_receipt WHERE fingerprint=?", fingerprint).Scan(&owner, &state) != nil || owner != run || state != "unknown" {
		return domain.ErrTaskConflict
	}
	var processing string
	if tx.QueryRowContext(ctx, "SELECT state FROM task_run_mail WHERE run_id=? AND mail_id=?", run, mail.ID).Scan(&processing) != nil || processing != "processing" {
		return domain.ErrTaskConflict
	}
	now, newCount, changes := time.Now().UnixMilli(), 0, 0
	for _, r := range output.Items {
		id := r.RelatedID
		if r.Kind == "new" {
			id = rand.Text()
			if _, err = tx.ExecContext(ctx, "INSERT INTO todo_item("+todoColumns+") VALUES(?,?,?,'',?,?,'suggested',1,?,?)",
				id, mail.AccountID, r.Title, r.Owner, r.Due, now, now); err != nil {
				return domain.ErrTaskStorage
			}
			newCount++
		} else {
			var account string
			if tx.QueryRowContext(ctx, "SELECT account_id FROM todo_item WHERE id=?", id).Scan(&account) != nil || account != mail.AccountID {
				return domain.ErrTaskConflict
			}
			var folder string
			rows, queryErr := tx.QueryContext(ctx, "SELECT folder FROM todo_source WHERE todo_id=? AND account_id=? LIMIT 500", id, account)
			if queryErr != nil {
				return domain.ErrTaskStorage
			}
			allowed := false
			for rows.Next() {
				if rows.Scan(&folder) != nil {
					rows.Close()
					return domain.ErrTaskStorage
				}
				allowed = allowed || p.Allows(account, folder)
			}
			rowErr, closeErr := rows.Err(), rows.Close()
			if rowErr != nil || closeErr != nil {
				return domain.ErrTaskStorage
			}
			if !allowed {
				return domain.ErrTaskConsent
			}
			changes++
		}
		var sourceCount int
		if tx.QueryRowContext(ctx, "SELECT count(*) FROM todo_source WHERE todo_id=?", id).Scan(&sourceCount) != nil {
			return domain.ErrTaskStorage
		}
		if sourceCount >= 500 {
			return domain.ErrTaskLimit
		}
		sourceID := rand.Text()
		if _, err = tx.ExecContext(ctx, `INSERT INTO todo_source(id,todo_id,mail_id,account_id,folder,subject,evidence,ai_title,body_revision,received_at,created_at)
			VALUES(?,?,?,?,?,?,?,?,?,?,?)`, sourceID, id, mail.ID, mail.AccountID, mail.Folder, mail.Subject, r.Evidence, r.Title, mail.BodyRevision, mail.ReceivedAt, now); err != nil {
			return domain.ErrTaskStorage
		}
		if r.Kind != "new" {
			if _, err = tx.ExecContext(ctx, `INSERT INTO todo_proposal(id,todo_id,source_id,kind,title,owner,due,reason,created_at)
				VALUES(?,?,?,?,?,?,?,?,?)`, rand.Text(), id, sourceID, r.Kind, r.Title, r.Owner, r.Due, r.Reason, now); err != nil {
				return domain.ErrTaskStorage
			}
		}
	}
	if _, err = tx.ExecContext(ctx, "UPDATE task_receipt SET state='success' WHERE fingerprint=? AND run_id=?", fingerprint, run); err != nil {
		return domain.ErrTaskStorage
	}
	if err := markTaskLedger(ctx, tx, mail, fingerprint, "success"); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, "UPDATE task_run_mail SET state='done',error='' WHERE run_id=? AND mail_id=?", run, mail.ID); err != nil {
		return domain.ErrTaskStorage
	}
	if _, err = tx.ExecContext(ctx, "UPDATE task_run SET new_count=new_count+?,change_count=change_count+? WHERE id=?", newCount, changes, run); err != nil {
		return domain.ErrTaskStorage
	}
	if tx.Commit() != nil {
		return domain.ErrTaskStorage
	}
	return nil
}
