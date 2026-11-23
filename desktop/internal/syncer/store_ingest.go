package syncer

import (
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"omnimail/internal/mailproto"
	"omnimail/internal/security"
	"omnimail/internal/storage"
)

type IngestInput struct {
	AccountID       string
	AccountEmail    string
	RemoteMailboxID string
	RemoteUID       uint32
	Folder          string
	IsUnread        bool
	IsStarred       bool
	ReceivedAt      time.Time
	RawBytes        []byte
	SizeBytes       int64
	Parsed          *mailproto.ParsedEmail
}

// IngestMessage 幂等入库单封邮件，完成 CAS 归档、HTML 净化、会话归并与 FTS5 全文建索。
func IngestMessage(db *sql.DB, blobs *storage.BlobStore, hooks PipelineHooks, in IngestInput) (msgID string, created bool, err error) {
	if in.Parsed == nil && len(in.RawBytes) > 0 {
		in.Parsed, err = mailproto.ParseRawMessage(in.RawBytes)
		if err != nil {
			return "", false, err
		}
	}
	if in.Parsed == nil {
		return "", false, nil
	}

	rfcClean := strings.Trim(strings.TrimSpace(in.Parsed.RFCMessageID), "<>")
	if existingID, matched := findExistingIngestedMessage(db, in, rfcClean); matched {
		return existingID, false, nil
	}

	var rawSHA string
	if blobs != nil && len(in.RawBytes) > 0 {
		rawSHA, _ = blobs.PutRawEML(in.RawBytes)
	}
	if in.SizeBytes <= 0 {
		in.SizeBytes = int64(len(in.RawBytes))
	}

	msgID = deriveMessageID(in.AccountID, in.RemoteMailboxID, in.RemoteUID, rfcClean)
	attRows, attNames, cidMap := prepareAttachmentRows(blobs, msgID, in.Parsed.Attachments)
	nowMs := time.Now().UnixMilli()

	sanitizedHTML, hasRemoteImg := security.SanitizeMailHTML(in.Parsed.BodyHTML, cidMap)
	if sanitizedHTML == "" && in.Parsed.BodyText != "" {
		sanitizedHTML = security.PlainTextToHTML(in.Parsed.BodyText)
	}
	snippet := mailproto.MakeSnippet(in.Parsed.BodyText, in.Parsed.BodyHTML, 140)
	recvMs, sentMs := normalizeMessageTimes(in.ReceivedAt, in.Parsed.SentAt)

	tx, err := db.Begin()
	if err != nil {
		return "", false, err
	}
	tid, err := resolveIngestThread(tx, in, rfcClean, recvMs, snippet)
	if err != nil {
		_ = tx.Rollback()
		return "", false, err
	}

	finalFolder := in.Folder
	unreadInt := boolToInt(in.IsUnread)
	starInt := boolToInt(in.IsStarred)
	var decision PreIngestDecision
	if hooks != nil {
		decision = hooks.BeforeMessageInsert(tx, in.AccountID, in.AccountEmail, in.Parsed, finalFolder)
		if decision.OverrideFolder != "" {
			finalFolder = decision.OverrideFolder
		}
		if decision.MarkRead {
			unreadInt = 0
		}
		if decision.MarkStarred {
			starInt = 1
		}
	}

	toJ, _ := json.Marshal(in.Parsed.To)
	ccJ, _ := json.Marshal(in.Parsed.Cc)
	refsJ, _ := json.Marshal(in.Parsed.References)
	_, err = tx.Exec(`
		INSERT INTO messages (
			id, account_id, thread_id, remote_mailbox_id, remote_uid, rfc_message_id, in_reply_to, references_json,
			folder, sender_name, sender_email, to_json, cc_json, subject, snippet, body_text, body_html_sanitized,
			raw_blob_sha256, raw_headers, sent_at, received_at, is_unread, is_starred, has_attachments,
			has_remote_images, security_json, meeting_invite_json, size_bytes
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		msgID, in.AccountID, tid, in.RemoteMailboxID, in.RemoteUID, rfcClean,
		strings.Trim(in.Parsed.InReplyTo, "<>"), string(refsJ), finalFolder,
		in.Parsed.Sender.Name, in.Parsed.Sender.Email, string(toJ), string(ccJ),
		in.Parsed.Subject, snippet, in.Parsed.BodyText, sanitizedHTML,
		rawSHA, in.Parsed.RawHeaders, sentMs, recvMs, unreadInt, starInt, boolToInt(len(attNames) > 0),
		boolToInt(hasRemoteImg), decision.SecurityJSON, decision.MeetingJSON, in.SizeBytes,
	)
	if err != nil {
		_ = tx.Rollback()
		return "", false, err
	}

	insertIngestedAuxRows(tx, msgID, in.Parsed, attRows, attNames, decision.AddLabelIDs, nowMs)
	_ = mailproto.RefreshThreadStats(tx, tid)
	if err := tx.Commit(); err != nil {
		return "", false, err
	}
	if hooks != nil {
		hooks.AfterMessageCommit(db, in.AccountID, in.AccountEmail, msgID, finalFolder, in.Parsed, true, decision.SuppressNotify)
	}
	return msgID, true, nil
}
