package repository

import (
	"context"

	"omnimail/desktop/internal/domain"
)

func (s *Store) RequirementCandidates(ctx context.Context, p domain.TaskPreferences, mail domain.TaskMail) ([]domain.RequirementCandidate, error) {
	result := []domain.RequirementCandidate{}
	if !p.Allows(mail.AccountID, mail.Folder) {
		return result, domain.ErrTaskConsent
	}
	// 只取同账号、仍在授权文件夹范围内的原始提取信息；不把人工备注/编辑内容外发。
	rows, err := s.db.QueryContext(ctx, `SELECT s.todo_id,s.ai_title,s.evidence,s.folder FROM todo_source s
		JOIN todo_item t ON t.id=s.todo_id WHERE s.account_id=? ORDER BY s.created_at DESC,s.id LIMIT 200`, mail.AccountID)
	if err != nil {
		return result, domain.ErrTaskStorage
	}
	defer rows.Close()
	seen := map[string]bool{}
	for rows.Next() {
		var c domain.RequirementCandidate
		var folder string
		if rows.Scan(&c.ID, &c.Title, &c.Evidence, &folder) != nil {
			return result, domain.ErrTaskStorage
		}
		if p.Allows(mail.AccountID, folder) && !seen[c.ID] && len(c.Evidence) <= 2000 {
			seen[c.ID] = true
			result = append(result, c)
			if len(result) == 8 {
				break
			}
		}
	}
	if rows.Err() != nil {
		return result, domain.ErrTaskStorage
	}
	return result, nil
}

func (s *Store) PendingTaskMails(ctx context.Context, p domain.TaskPreferences) ([]string, int, int, error) {
	scope, args := taskScope(p)
	base := ` FROM mail_message m JOIN mailbox b ON b.id=m.mailbox_id JOIN account a ON a.id=m.account_id
		JOIN task_mail_seen seen ON seen.mail_id=m.id JOIN task_baseline q ON q.mailbox_id=b.id AND q.uid_validity=m.uid_validity
		WHERE a.status='configured' AND a.sync_enabled=1 AND ` + scope + `
		AND ((m.uid_validity>0 AND m.uid>q.baseline_uid) OR
		(m.uid_validity=0 AND seen.seq>q.baseline_seq AND m.received_at>=q.started_at))
		AND NOT EXISTS(SELECT 1 FROM task_mail_ledger l WHERE l.mail_id=m.id AND l.body_revision=m.ai_body_revision)`
	var ready, waiting int
	if s.db.QueryRowContext(ctx, `SELECT coalesce(sum(CASE WHEN m.body_version>=1 AND m.body_error_code='' AND m.body_text IS NOT NULL THEN 1 ELSE 0 END),0),
		coalesce(sum(CASE WHEN m.body_version<1 OR m.body_error_code!='' OR m.body_text IS NULL THEN 1 ELSE 0 END),0)`+base, args...).Scan(&ready, &waiting) != nil {
		return nil, 0, 0, domain.ErrTaskStorage
	}
	queryArgs := append(append([]interface{}{}, args...), p.Limit)
	rows, err := s.db.QueryContext(ctx, `SELECT m.id`+base+` AND m.body_version>=1 AND m.body_error_code='' AND m.body_text IS NOT NULL ORDER BY seen.seq,m.id LIMIT ?`, queryArgs...)
	if err != nil {
		return nil, 0, 0, domain.ErrTaskStorage
	}
	defer rows.Close()
	ids := []string{}
	for rows.Next() {
		var id string
		if rows.Scan(&id) != nil {
			return nil, 0, 0, domain.ErrTaskStorage
		}
		ids = append(ids, id)
	}
	if rows.Err() != nil {
		return nil, 0, 0, domain.ErrTaskStorage
	}
	return ids, waiting, max(0, ready-len(ids)), nil
}
