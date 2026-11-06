package repository

import (
	"context"
	"database/sql"
	"errors"

	"omnimail/desktop/internal/domain"
)

const sourceColumns = "s.id,s.todo_id,s.mail_id,s.account_id,s.subject,s.evidence,s.received_at,EXISTS(SELECT 1 FROM mail_message m WHERE m.id=s.mail_id AND m.account_id=s.account_id)"

func scanTodoSource(row todoScanner) (v domain.TodoSource, err error) {
	err = row.Scan(&v.ID, &v.TodoID, &v.MailID, &v.AccountID, &v.Subject, &v.Evidence, &v.ReceivedAt, &v.Available)
	if err != nil {
		return v, domain.ErrTaskStorage
	}
	return v, nil
}
func (s *Store) TodoDetails(ctx context.Context, id string) (domain.TodoDetails, error) {
	result := domain.TodoDetails{Sources: []domain.TodoSource{}, Proposals: []domain.TodoProposal{}}
	if !domain.ValidAccountID(id) {
		return result, domain.ErrTaskInput
	}
	item, err := scanTodo(s.db.QueryRowContext(ctx, "SELECT "+todoColumns+" FROM todo_item WHERE id=?", id))
	if err != nil {
		return result, err
	}
	result.Item = item
	rows, err := s.db.QueryContext(ctx, "SELECT "+sourceColumns+" FROM todo_source s WHERE s.todo_id=? ORDER BY s.created_at DESC,s.id LIMIT 51", id)
	if err != nil {
		return result, domain.ErrTaskStorage
	}
	for rows.Next() {
		value, scanErr := scanTodoSource(rows)
		if scanErr != nil {
			rows.Close()
			return result, scanErr
		}
		result.Sources = append(result.Sources, value)
	}
	readErr, closeErr := rows.Err(), rows.Close()
	if readErr != nil || closeErr != nil {
		return result, domain.ErrTaskStorage
	}
	if len(result.Sources) > 50 {
		result.Truncated = true
		result.Sources = result.Sources[:50]
	}
	rows, err = s.db.QueryContext(ctx, `SELECT p.id,p.todo_id,p.source_id,p.kind,p.title,p.owner,p.due,p.reason,s.evidence,p.state,p.created_at
		FROM todo_proposal p JOIN todo_source s ON s.id=p.source_id WHERE p.todo_id=? AND p.state='open' ORDER BY p.created_at DESC,p.id LIMIT 51`, id)
	if err != nil {
		return result, domain.ErrTaskStorage
	}
	for rows.Next() {
		var p domain.TodoProposal
		if rows.Scan(&p.ID, &p.TodoID, &p.SourceID, &p.Kind, &p.Title, &p.Owner, &p.Due, &p.Reason, &p.Evidence, &p.State, &p.CreatedAt) != nil {
			rows.Close()
			return result, domain.ErrTaskStorage
		}
		result.Proposals = append(result.Proposals, p)
	}
	readErr, closeErr = rows.Err(), rows.Close()
	if readErr != nil || closeErr != nil {
		return result, domain.ErrTaskStorage
	}
	if len(result.Proposals) > 50 {
		result.Truncated = true
		result.Proposals = result.Proposals[:50]
	}
	return result, nil
}

func (s *Store) TodoSource(ctx context.Context, id string) (domain.TodoSource, int, error) {
	if !domain.ValidAccountID(id) {
		return domain.TodoSource{}, 0, domain.ErrTaskInput
	}
	value, err := scanTodoSource(s.db.QueryRowContext(ctx, "SELECT "+sourceColumns+" FROM todo_source s WHERE s.id=?", id))
	if err != nil {
		return value, 0, err
	}
	var revision int
	if s.db.QueryRowContext(ctx, "SELECT body_revision FROM todo_source WHERE id=?", id).Scan(&revision) != nil {
		return value, 0, domain.ErrTaskStorage
	}
	return value, revision, nil
}

func (s *Store) ReadTaskMail(ctx context.Context, id string) (domain.TaskMail, error) {
	if !domain.ValidAccountID(id) {
		return domain.TaskMail{}, domain.ErrTaskInput
	}
	var result domain.TaskMail
	// 一次查询读取正文与版本，不能把两次查询之间的新版本号配到旧正文上。
	err := s.db.QueryRowContext(ctx, `SELECT m.id,m.account_id,b.remote_name,m.subject,m.from_addr,m.to_addrs,
		m.received_at,m.is_read,m.is_starred,m.body_text IS NOT NULL,coalesce(m.body_text,''),m.body_html,
		m.body_version,m.body_error_code,coalesce(m.message_id,''),b.kind,m.ai_body_revision
		FROM mail_message m JOIN mailbox b ON b.id=m.mailbox_id WHERE m.id=?`, id).
		Scan(&result.ID, &result.AccountID, &result.Mailbox, &result.Subject, &result.From, &result.To, &result.ReceivedAt,
			&result.Read, &result.Starred, &result.Cached, &result.Body, &result.RawHTML, &result.BodyVersion,
			&result.BodyErrorCode, &result.MessageID, &result.Folder, &result.BodyRevision)
	if errors.Is(err, sql.ErrNoRows) {
		return result, domain.ErrTaskNotFound
	}
	if err != nil {
		return result, domain.ErrTaskStorage
	}
	return result, nil
}
