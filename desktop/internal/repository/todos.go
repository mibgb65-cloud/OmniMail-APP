package repository

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"time"

	"omnimail/desktop/internal/domain"
)

const todoColumns = "id,account_id,title,notes,owner,due,status,version,created_at,updated_at"

type todoScanner interface{ Scan(...interface{}) error }

func scanTodo(row todoScanner) (domain.Todo, error) {
	var v domain.Todo
	err := row.Scan(&v.ID, &v.AccountID, &v.Title, &v.Notes, &v.Owner, &v.Due, &v.Status, &v.Version, &v.CreatedAt, &v.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return v, domain.ErrTaskNotFound
	}
	if err != nil {
		return v, domain.ErrTaskStorage
	}
	if (domain.TodoEdit{ID: v.ID, AccountID: v.AccountID, Version: v.Version, Title: v.Title, Notes: v.Notes, Owner: v.Owner, Due: v.Due, Status: v.Status}).Validate() != nil {
		return domain.Todo{}, domain.ErrTaskStorage
	}
	return v, nil
}

func (s *Store) ListTodos(ctx context.Context, status string, offset int) ([]domain.Todo, error) {
	if (status != "all" && !domain.ValidTodoStatus(status)) || offset < 0 || offset > 10000 {
		return nil, domain.ErrTaskInput
	}
	rows, err := s.db.QueryContext(ctx, "SELECT "+todoColumns+" FROM todo_item WHERE (?='all' OR status=?) ORDER BY updated_at DESC,id LIMIT 100 OFFSET ?", status, status, offset)
	if err != nil {
		return nil, domain.ErrTaskStorage
	}
	defer rows.Close()
	result := []domain.Todo{}
	for rows.Next() {
		v, err := scanTodo(rows)
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

func (s *Store) EditTodo(ctx context.Context, e domain.TodoEdit) (value domain.Todo, err error) {
	if e.Validate() != nil {
		return value, domain.ErrTaskInput
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return value, domain.ErrTaskStorage
	}
	defer rollback(tx, &err)
	now := time.Now().UnixMilli()
	if e.ID == "" {
		if e.AccountID != "" {
			var exists int
			if tx.QueryRowContext(ctx, "SELECT count(*) FROM account WHERE id=?", e.AccountID).Scan(&exists) != nil {
				return value, domain.ErrTaskStorage
			}
			if exists != 1 {
				return value, domain.ErrTaskInput
			}
		}
		var count int
		if tx.QueryRowContext(ctx, "SELECT count(*) FROM todo_item").Scan(&count) != nil {
			return value, domain.ErrTaskStorage
		}
		if count >= 10000 {
			return value, domain.ErrTaskLimit
		}
		e.ID = rand.Text()
		_, err = tx.ExecContext(ctx, "INSERT INTO todo_item("+todoColumns+") VALUES(?,?,?,?,?,?,?,1,?,?)", e.ID, e.AccountID, e.Title, e.Notes, e.Owner, e.Due, e.Status, now, now)
	} else {
		result, writeErr := tx.ExecContext(ctx, "UPDATE todo_item SET title=?,notes=?,owner=?,due=?,status=?,version=version+1,updated_at=? WHERE id=? AND version=?", e.Title, e.Notes, e.Owner, e.Due, e.Status, now, e.ID, e.Version)
		if writeErr != nil {
			return value, domain.ErrTaskStorage
		}
		if n, countErr := result.RowsAffected(); countErr != nil {
			return value, domain.ErrTaskStorage
		} else if n != 1 {
			return value, domain.ErrTaskConflict
		}
	}
	if err != nil {
		return value, domain.ErrTaskStorage
	}
	value, err = scanTodo(tx.QueryRowContext(ctx, "SELECT "+todoColumns+" FROM todo_item WHERE id=?", e.ID))
	if err != nil {
		return value, err
	}
	if tx.Commit() != nil {
		return value, domain.ErrTaskStorage
	}
	return value, nil
}

func (s *Store) DeleteTodo(ctx context.Context, id string, version int) error {
	if !domain.ValidAccountID(id) || version < 1 {
		return domain.ErrTaskInput
	}
	result, err := s.db.ExecContext(ctx, "DELETE FROM todo_item WHERE id=? AND version=?", id, version)
	if err != nil {
		return domain.ErrTaskStorage
	}
	if n, err := result.RowsAffected(); err != nil {
		return domain.ErrTaskStorage
	} else if n != 1 {
		return domain.ErrTaskConflict
	}
	return nil
}

func (s *Store) ResolveTodo(ctx context.Context, id string, version int, accept bool) (err error) {
	if !domain.ValidAccountID(id) || version < 1 {
		return domain.ErrTaskInput
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.ErrTaskStorage
	}
	defer rollback(tx, &err)
	var proposal domain.TodoProposal
	if tx.QueryRowContext(ctx, "SELECT todo_id,kind,title,owner,due FROM todo_proposal WHERE id=? AND state='open'", id).Scan(&proposal.TodoID, &proposal.Kind, &proposal.Title, &proposal.Owner, &proposal.Due) != nil {
		return domain.ErrTaskNotFound
	}
	item, err := scanTodo(tx.QueryRowContext(ctx, "SELECT "+todoColumns+" FROM todo_item WHERE id=?", proposal.TodoID))
	if err != nil {
		return err
	}
	if item.Version != version {
		return domain.ErrTaskConflict
	}
	state := "dismissed"
	if accept {
		state = "accepted"
		if proposal.Kind == "complete" {
			item.Status = "done"
		} else if proposal.Kind == "cancel" {
			item.Status = "dismissed"
		} else {
			item.Title = proposal.Title
			// 模型不明确的字段不清除人工填写值；用户仍可通过编辑显式清空。
			if proposal.Owner != "" {
				item.Owner = proposal.Owner
			}
			if proposal.Due != "" {
				item.Due = proposal.Due
			}
		}
		if _, err = tx.ExecContext(ctx, "UPDATE todo_item SET title=?,owner=?,due=?,status=?,version=version+1,updated_at=? WHERE id=?", item.Title, item.Owner, item.Due, item.Status, time.Now().UnixMilli(), item.ID); err != nil {
			return domain.ErrTaskStorage
		}
	}
	if _, err = tx.ExecContext(ctx, "UPDATE todo_proposal SET state=? WHERE id=? AND state='open'", state, id); err != nil {
		return domain.ErrTaskStorage
	}
	if tx.Commit() != nil {
		return domain.ErrTaskStorage
	}
	return nil
}
