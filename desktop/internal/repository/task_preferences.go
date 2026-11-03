package repository

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"time"

	"omnimail/desktop/internal/domain"
)

type taskQuery interface {
	QueryRowContext(context.Context, string, ...interface{}) *sql.Row
}

func readTaskPreferences(ctx context.Context, q taskQuery) (domain.TaskPreferences, error) {
	var raw string
	err := q.QueryRowContext(ctx, "SELECT value FROM task_preferences WHERE id=1").Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.TaskPreferences{TaskPreferencesInput: domain.TaskPreferencesInput{
			Accounts: []string{}, Folders: []string{"inbox"}, Time: "09:00", Timezone: "UTC", Limit: 20}}, nil
	}
	if err != nil || len(raw) > 16384 {
		return domain.TaskPreferences{}, domain.ErrTaskStorage
	}
	var p domain.TaskPreferences
	decoder := json.NewDecoder(bytes.NewBufferString(raw))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&p) != nil || decoder.Decode(new(json.RawMessage)) != io.EOF ||
		p.TaskPreferencesInput.Validate() != nil || !domain.ValidAccountID(p.Revision) ||
		(p.Consent && !domain.ValidAccountID(p.AIRevision)) {
		return p, domain.ErrTaskStorage
	}
	return p, nil
}
func (s *Store) ReadTaskPreferences(ctx context.Context) (domain.TaskPreferences, error) {
	return readTaskPreferences(ctx, s.db)
}

func (s *Store) WriteTaskPreferences(ctx context.Context, p domain.TaskPreferences) (err error) {
	if p.TaskPreferencesInput.Validate() != nil || !domain.ValidAccountID(p.Revision) ||
		(p.Consent && !domain.ValidAccountID(p.AIRevision)) {
		return domain.ErrTaskInput
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.ErrTaskStorage
	}
	defer rollback(tx, &err)
	old, err := readTaskPreferences(ctx, tx)
	if err != nil {
		return err
	}
	for _, id := range p.Accounts {
		var found int
		if tx.QueryRowContext(ctx, "SELECT count(*) FROM account WHERE id=?", id).Scan(&found) != nil {
			return domain.ErrTaskStorage
		}
		if found != 1 {
			return domain.ErrTaskInput
		}
	}
	raw, err := json.Marshal(p)
	if err != nil {
		return domain.ErrTaskInput
	}
	if _, err = tx.ExecContext(ctx, "INSERT INTO task_preferences(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value", string(raw)); err != nil {
		return domain.ErrTaskStorage
	}
	// 撤销/换模型目的地后重新授权建立新基线，不把旧授权期积压内容静默交给新配置。
	if !p.Consent || old.AIRevision != p.AIRevision {
		if _, err = tx.ExecContext(ctx, "DELETE FROM task_baseline"); err != nil {
			return domain.ErrTaskStorage
		}
	}
	if err = reconcileTaskBaselines(ctx, tx, p); err != nil {
		return err
	}
	if tx.Commit() != nil {
		return domain.ErrTaskStorage
	}
	return nil
}

func reconcileTaskBaselines(ctx context.Context, tx *sql.Tx, p domain.TaskPreferences) error {
	rows, err := tx.QueryContext(ctx, "SELECT id,account_id,kind,uid_validity,ai_head_uid,ai_head_known FROM mailbox")
	if err != nil {
		return domain.ErrTaskStorage
	}
	type box struct {
		id, account, kind string
		validity, head    uint32
		known             bool
	}
	boxes := []box{}
	for rows.Next() {
		var b box
		if rows.Scan(&b.id, &b.account, &b.kind, &b.validity, &b.head, &b.known) != nil {
			rows.Close()
			return domain.ErrTaskStorage
		}
		boxes = append(boxes, b)
	}
	readErr, closeErr := rows.Err(), rows.Close()
	if readErr != nil || closeErr != nil {
		return domain.ErrTaskStorage
	}
	var seq int64
	if tx.QueryRowContext(ctx, "SELECT coalesce(max(seq),0) FROM task_mail_seen").Scan(&seq) != nil {
		return domain.ErrTaskStorage
	}
	for _, b := range boxes {
		if !p.Consent || !p.Allows(b.account, b.kind) {
			if _, err = tx.ExecContext(ctx, "DELETE FROM task_baseline WHERE mailbox_id=?", b.id); err != nil {
				return domain.ErrTaskStorage
			}
		} else if b.known {
			if _, err = tx.ExecContext(ctx, `INSERT INTO task_baseline(mailbox_id,uid_validity,baseline_uid,baseline_seq,started_at)
				VALUES(?,?,?,?,?) ON CONFLICT(mailbox_id) DO UPDATE SET uid_validity=excluded.uid_validity,
				baseline_uid=excluded.baseline_uid,baseline_seq=excluded.baseline_seq,started_at=excluded.started_at
				WHERE task_baseline.uid_validity!=excluded.uid_validity`, b.id, b.validity, b.head, seq, time.Now().UnixMilli()); err != nil {
				return domain.ErrTaskStorage
			}
		}
	}
	return nil
}

func (s *Store) ObserveMailboxHead(ctx context.Context, account, id string, validity, head uint32) (err error) {
	if !domain.ValidAccountID(account) || !domain.ValidAccountID(id) {
		return domain.ErrInvalidAccount
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.ErrTaskStorage
	}
	defer rollback(tx, &err)
	result, err := tx.ExecContext(ctx, "UPDATE mailbox SET ai_head_uid=?,ai_head_known=1 WHERE id=? AND account_id=? AND uid_validity=?", head, id, account, validity)
	if err != nil {
		return domain.ErrTaskStorage
	}
	if n, err := result.RowsAffected(); err != nil || n != 1 {
		return domain.ErrTaskStorage
	}
	p, err := readTaskPreferences(ctx, tx)
	if err != nil {
		return err
	}
	if p.Consent {
		if err := reconcileTaskBaselines(ctx, tx, p); err != nil {
			return err
		}
	}
	if tx.Commit() != nil {
		return domain.ErrTaskStorage
	}
	return nil
}

// 这里只拼接已确定的占位符和编译期表别名，账号/文件夹值始终作为绑定参数。
func taskScope(p domain.TaskPreferences) (string, []interface{}) {
	args := []interface{}{}
	for _, id := range p.Accounts {
		args = append(args, id)
	}
	for _, folder := range p.Folders {
		args = append(args, folder)
	}
	if len(p.Accounts) == 0 {
		return "0", args
	}
	return "m.account_id IN (" + strings.TrimRight(strings.Repeat("?,", len(p.Accounts)), ",") +
		") AND b.kind IN (" + strings.TrimRight(strings.Repeat("?,", len(p.Folders)), ",") + ")", args
}
