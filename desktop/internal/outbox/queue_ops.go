package outbox

import (
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/events"
	"omnimail/internal/mailproto"
	"omnimail/internal/profilemgr"
	"omnimail/internal/search"
)

func (s *Scheduler) persistJob(
	sess *profilemgr.Session,
	accountID, draftID, subject, bodyText, bodyHTML string,
	built *mailproto.BuiltMessage,
	state string,
	notBeforeMs int64,
) (OutboxJobDTO, error) {
	rawSHA, err := sess.Blobs.PutRawEML(built.RawBytes)
	if err != nil {
		return OutboxJobDTO{}, err
	}
	nowMs := time.Now().UnixMilli()
	jobID := newRandomJobID("job")
	msgID := "outmsg-" + jobID
	tid := "thr-" + msgID
	cleanSubj := strings.TrimSpace(subject)
	if cleanSubj == "" {
		cleanSubj = "（无主题）"
	}
	snippet := mailproto.MakeSnippet(bodyText, bodyHTML, 120)

	var fromName, fromEmail string
	_ = sess.DB.QueryRow(`SELECT COALESCE(NULLIF(sender_name,''), name), email FROM accounts WHERE id=?`,
		accountID).Scan(&fromName, &fromEmail)
	env := EnvelopeMeta{
		FromName: fromName, FromEmail: built.FromEnvelope, EnvelopeRecipients: built.EnvelopeRecipients,
		Subject: cleanSubj, Snippet: snippet, BodyText: bodyText,
		ToAddrs: built.ToAddrs, CcAddrs: built.CcAddrs, BccAddrs: built.BccAddrs,
	}
	envJ, _ := json.Marshal(env)

	folder, schedVal := "outbox", int64(0)
	if state == "scheduled" {
		folder, schedVal = "scheduled", notBeforeMs
	}
	toJ, _ := json.Marshal(built.ToAddrs)
	ccJ, _ := json.Marshal(built.CcAddrs)
	bccJ, _ := json.Marshal(built.BccAddrs)

	_, _ = sess.DB.Exec(`
		INSERT INTO threads(id, account_id, subject, snippet, last_msg_at, msg_count, unread_count, has_star, has_attachment)
		VALUES (?, ?, ?, ?, ?, 1, 0, 0, 0)
	`, tid, accountID, cleanSubj, snippet, nowMs)
	_, _ = sess.DB.Exec(`
		INSERT INTO messages (
			id, account_id, thread_id, rfc_message_id, folder, sender_name, sender_email,
			to_json, cc_json, bcc_json, subject, snippet, body_text, body_html_sanitized,
			raw_blob_sha256, sent_at, received_at, is_unread, scheduled_at, size_bytes
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
	`, msgID, accountID, tid, built.RFCMessageID, folder, fromName, fromEmail,
		string(toJ), string(ccJ), string(bccJ), cleanSubj, snippet, bodyText, sanitizeJobHTML(bodyText, bodyHTML),
		rawSHA, nowMs, nowMs, schedVal, int64(len(built.RawBytes)))

	if draftID != "" {
		deleteJobMirrorMessage(sess.DB, DraftMessageID(draftID))
	}

	_, err = sess.DB.Exec(`
		INSERT INTO outbox_jobs (
			id, account_id, draft_id, message_id, rfc_message_id, envelope_json,
			raw_mime_sha256, state, not_before_at, retry_count, max_retries, last_error, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 5, '', ?, ?)
	`, jobID, accountID, draftID, msgID, built.RFCMessageID, string(envJ), rawSHA, state, notBeforeMs, nowMs, nowMs)
	if err != nil {
		return OutboxJobDTO{}, err
	}

	dto := OutboxJobDTO{
		ID: jobID, AccountID: accountID, DraftID: draftID, MessageID: msgID,
		RFCMessageID: built.RFCMessageID, Subject: cleanSubj,
		Recipients: strings.Join(built.EnvelopeRecipients, ", "),
		State:      state, NotBeforeAt: notBeforeMs, MaxRetries: 5, CreatedAt: nowMs, UpdatedAt: nowMs,
	}
	s.emitOutboxAndDelta(sess.DB, accountID, jobID, state, notBeforeMs, "")
	if notBeforeMs <= nowMs {
		go s.processDueJobs(sess.Ctx, sess)
	}
	return dto, nil
}

// UndoSend 在 undo_pending 窗口内原子取消发送并还原回草稿状态（零网络请求）。
func (s *Scheduler) UndoSend(sess *profilemgr.Session, jobID string) (ComposeDraftState, error) {
	nowMs := time.Now().UnixMilli()
	res, err := sess.DB.Exec(`UPDATE outbox_jobs SET state='canceled', updated_at=? WHERE id=? AND state='undo_pending'`, nowMs, jobID)
	if err != nil {
		return ComposeDraftState{}, err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return ComposeDraftState{}, apperr.New(apperr.CodeUndoWindowExpired, "邮件已发出，无法撤回")
	}

	var accID, draftID, msgID string
	_ = sess.DB.QueryRow(`SELECT account_id, draft_id, message_id FROM outbox_jobs WHERE id=?`, jobID).Scan(&accID, &draftID, &msgID)
	deleteJobMirrorMessage(sess.DB, msgID)
	s.emitOutboxAndDelta(sess.DB, accID, jobID, "canceled", nowMs, "")
	if draftID == "" {
		return ComposeDraftState{}, nil
	}
	d, err := GetDraft(sess.DB, draftID)
	if err == nil {
		upsertDraftPreviewMessage(sess.DB, d, nowMs)
	}
	return d, err
}

func deleteJobMirrorMessage(db *sql.DB, msgID string) {
	if msgID == "" {
		return
	}
	_, _ = db.Exec(`DELETE FROM messages WHERE id=?`, msgID)
	_, _ = db.Exec(`DELETE FROM threads WHERE id=?`, "thr-"+msgID)
}

func (s *Scheduler) SendNow(sess *profilemgr.Session, jobID string) error {
	nowMs := time.Now().UnixMilli()
	res, err := sess.DB.Exec(`
		UPDATE outbox_jobs SET state='undo_pending', not_before_at=?, updated_at=?
		WHERE id=? AND state IN ('undo_pending', 'scheduled', 'failed', 'failed_retry')
	`, nowMs, nowMs, jobID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return apperr.New(apperr.CodeNotFound, "发件任务不存在或正在投递中")
	}
	go s.processDueJobs(sess.Ctx, sess)
	return nil
}

func (s *Scheduler) RetryJob(sess *profilemgr.Session, jobIDOrMsgID string) error {
	jobID := resolveJobID(sess.DB, jobIDOrMsgID)
	return s.SendNow(sess, jobID)
}

func (s *Scheduler) CancelJob(sess *profilemgr.Session, jobIDOrMsgID string) error {
	jobID := resolveJobID(sess.DB, jobIDOrMsgID)
	nowMs := time.Now().UnixMilli()
	var accID, draftID, msgID string
	_ = sess.DB.QueryRow(`SELECT account_id, draft_id, message_id FROM outbox_jobs WHERE id=?`, jobID).Scan(&accID, &draftID, &msgID)
	res, err := sess.DB.Exec(`
		UPDATE outbox_jobs SET state='canceled', updated_at=?
		WHERE id=? AND state IN ('undo_pending', 'scheduled', 'failed', 'failed_retry')
	`, nowMs, jobID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return apperr.New(apperr.CodeNotFound, "无法取消该任务（可能已成功投递）")
	}
	deleteJobMirrorMessage(sess.DB, msgID)
	if draftID != "" {
		if d, dErr := GetDraft(sess.DB, draftID); dErr == nil {
			upsertDraftPreviewMessage(sess.DB, d, nowMs)
		}
	}
	s.emitOutboxAndDelta(sess.DB, accID, jobID, "canceled", nowMs, "")
	return nil
}

func resolveJobID(db *sql.DB, id string) string {
	var jobID string
	if db.QueryRow(`SELECT id FROM outbox_jobs WHERE id=? OR message_id=? LIMIT 1`, id, id).Scan(&jobID) == nil && jobID != "" {
		return jobID
	}
	return id
}

func (s *Scheduler) emitOutboxAndDelta(db *sql.DB, accountID, jobID, state string, notBefore int64, lastErr string) {
	if s.bus == nil {
		return
	}
	s.bus.Emit(events.OutboxUpdated, events.OutboxUpdatedPayload{
		JobID: jobID, State: state, NotBeforeAt: notBefore, LastError: lastErr,
	})
	counts, _ := search.GetFolderCounts(db, "")
	s.bus.Emit(events.MailDelta, events.MailDeltaPayload{
		AccountID: accountID, FolderCounts: counts.Counts,
	})
}
