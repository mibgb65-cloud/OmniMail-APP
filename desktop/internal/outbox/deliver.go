package outbox

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"omnimail/internal/accounts"
	"omnimail/internal/mailproto"
	"omnimail/internal/profilemgr"
	"omnimail/internal/security"
)

type dueJobRow struct {
	id, accountID, draftID, msgID, rfcID, envJSON, rawSHA, state string
	retryCount, maxRetries                                       int
}

func ListJobs(db *sql.DB, filter string) ([]OutboxJobDTO, error) {
	f := strings.ToLower(strings.TrimSpace(filter))
	where := "state IN ('undo_pending', 'sending', 'failed', 'failed_retry')"
	if f == "scheduled" {
		where = "state = 'scheduled'"
	} else if f == "all" {
		where = "state != 'canceled'"
	}
	rows, err := db.Query(`
		SELECT id, account_id, draft_id, message_id, rfc_message_id, envelope_json,
		       state, not_before_at, retry_count, max_retries, last_error, created_at, updated_at
		FROM outbox_jobs
		WHERE ` + where + `
		ORDER BY not_before_at ASC, created_at DESC LIMIT 200
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]OutboxJobDTO, 0)
	for rows.Next() {
		var j OutboxJobDTO
		var envJ string
		if err := rows.Scan(
			&j.ID, &j.AccountID, &j.DraftID, &j.MessageID, &j.RFCMessageID, &envJ,
			&j.State, &j.NotBeforeAt, &j.RetryCount, &j.MaxRetries, &j.LastError, &j.CreatedAt, &j.UpdatedAt,
		); err != nil {
			continue
		}
		var env EnvelopeMeta
		_ = json.Unmarshal([]byte(envJ), &env)
		j.Subject = env.Subject
		j.Recipients = strings.Join(env.EnvelopeRecipients, ", ")
		out = append(out, j)
	}
	return out, nil
}

func (s *Scheduler) processDueJobs(ctx context.Context, sess *profilemgr.Session) {
	if sess == nil || sess.DB == nil {
		return
	}
	nowMs := time.Now().UnixMilli()
	rows, err := sess.DB.Query(`
		SELECT id, account_id, draft_id, message_id, rfc_message_id, envelope_json, raw_mime_sha256, state, retry_count, max_retries
		FROM outbox_jobs
		WHERE state IN ('undo_pending', 'scheduled', 'failed_retry') AND not_before_at <= ?
		ORDER BY not_before_at ASC LIMIT 10
	`, nowMs)
	if err != nil {
		return
	}
	var due []dueJobRow
	for rows.Next() {
		var r dueJobRow
		if rows.Scan(&r.id, &r.accountID, &r.draftID, &r.msgID, &r.rfcID, &r.envJSON, &r.rawSHA, &r.state, &r.retryCount, &r.maxRetries) == nil {
			due = append(due, r)
		}
	}
	_ = rows.Close()

	for _, job := range due {
		if ctx.Err() != nil {
			return
		}
		// 原子抢占状态为 sending，彻底消除与 UndoSend 的并发竞态
		res, uErr := sess.DB.Exec(`UPDATE outbox_jobs SET state='sending', updated_at=? WHERE id=? AND state=?`,
			time.Now().UnixMilli(), job.id, job.state)
		if uErr != nil {
			continue
		}
		if n, _ := res.RowsAffected(); n == 0 {
			continue
		}
		s.deliverSingleJob(ctx, sess, job)
	}
}

func (s *Scheduler) deliverSingleJob(ctx context.Context, sess *profilemgr.Session, job dueJobRow) {
	start := time.Now()
	rawBytes, err := sess.Blobs.GetRawEML(job.rawSHA)
	if err != nil {
		s.markJobFailed(sess.DB, job, true, "读取本地归档邮件失败: "+err.Error(), 0)
		return
	}
	var env EnvelopeMeta
	_ = json.Unmarshal([]byte(job.envJSON), &env)

	ep, accDTO, err := accounts.ResolveEndpointConfig(ctx, sess.DB, sess.Vault, s.tm, job.accountID)
	if err != nil {
		s.markJobFailed(sess.DB, job, isPermanentSendError(err), security.RedactSensitive(err.Error()), 0)
		return
	}

	s.mu.Lock()
	override := s.transportOverride
	sentHook := s.onMessageSent
	s.mu.Unlock()

	sendCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	var sendErr error
	if override != nil {
		sendErr = override(sendCtx, ep, env.FromEmail, env.EnvelopeRecipients, rawBytes)
	} else {
		sendErr = sendViaSMTP(sendCtx, ep, env.FromEmail, env.EnvelopeRecipients, rawBytes)
	}
	cancel()

	durMs := time.Since(start).Milliseconds()
	if sendErr != nil {
		redacted := humanizeSendError(security.RedactSensitive(sendErr.Error()))
		s.markJobFailed(sess.DB, job, isPermanentSendError(sendErr), redacted, durMs)
		return
	}

	nowMs := time.Now().UnixMilli()
	_, _ = sess.DB.Exec(`UPDATE outbox_jobs SET state='sent', last_error='', updated_at=? WHERE id=?`, nowMs, job.id)
	_, _ = sess.DB.Exec(`
		UPDATE messages SET folder='sent', scheduled_at=0, outbox_error='', sent_at=?, received_at=?, is_unread=0
		WHERE id=?
	`, nowMs, nowMs, job.msgID)
	if job.draftID != "" {
		_ = DeleteDraft(sess.DB, job.draftID)
	}
	recordSendLog(sess.DB, job.accountID, "INFO", "SMTP 发送成功", env.Subject, durMs)
	if sentHook != nil {
		sentHook(sess.DB, job.accountID, env.ToAddrs, env.CcAddrs)
	}
	s.emitOutboxAndDelta(sess.DB, job.accountID, job.id, "sent", nowMs, "")

	preset := mailproto.PresetByID(accDTO.Provider)
	if override == nil && !preset.AutoAppendsSent {
		go appendToRemoteSent(sess.Ctx, sess.DB, ep, rawBytes)
	}
}

func sendViaSMTP(ctx context.Context, ep mailproto.EndpointConfig, from string, rcpts []string, raw []byte) error {
	c, err := mailproto.ConnectSMTP(ctx, ep)
	if err != nil {
		return err
	}
	defer func() { _ = c.Quit() }()
	return c.SendMail(from, rcpts, bytes.NewReader(raw))
}
