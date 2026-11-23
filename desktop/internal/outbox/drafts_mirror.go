package outbox

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"omnimail/internal/apperr"
	"omnimail/internal/mailproto"
	"omnimail/internal/security"
)

func pickInitialAccountID(db *sql.DB, explicitID, defaultID string) (string, error) {
	for _, cand := range []string{strings.TrimSpace(explicitID), strings.TrimSpace(defaultID)} {
		if cand == "" {
			continue
		}
		var exists string
		if db.QueryRow(`SELECT id FROM accounts WHERE id = ?`, cand).Scan(&exists) == nil && exists != "" {
			return exists, nil
		}
	}
	var firstID string
	if err := db.QueryRow(`SELECT id FROM accounts ORDER BY is_default DESC, created_at ASC LIMIT 1`).Scan(&firstID); err == nil && firstID != "" {
		return firstID, nil
	}
	return "", apperr.New(apperr.CodeInvalidInput, "当前空间尚未添加任何邮箱账户，请先接入邮箱")
}

func queryAccountSignature(db *sql.DB, accountID string) string {
	var sig string
	_ = db.QueryRow(`SELECT signature FROM accounts WHERE id = ?`, accountID).Scan(&sig)
	return strings.TrimSpace(sig)
}

func copyReadyAttachments(db *sql.DB, mailID string) []DraftAttachmentDTO {
	rows, err := db.Query(`
		SELECT id, filename, mime_type, size_bytes, local_path
		FROM attachments
		WHERE message_id = ? AND is_inline = 0 AND status = 'ready' AND local_path != ''
	`, mailID)
	if err != nil {
		return []DraftAttachmentDTO{}
	}
	defer rows.Close()
	var out []DraftAttachmentDTO
	for rows.Next() {
		var id, fn, mt, path string
		var sz int64
		if rows.Scan(&id, &fn, &mt, &sz, &path) == nil {
			out = append(out, DraftAttachmentDTO{
				ID:        "att-" + id,
				Name:      fn,
				SizeBytes: sz,
				SizeText:  formatBytes(sz),
				FilePath:  path,
				MimeType:  mt,
				Status:    "ready",
			})
		}
	}
	if out == nil {
		return []DraftAttachmentDTO{}
	}
	return out
}

func upsertDraftPreviewMessage(db *sql.DB, draft ComposeDraftState, nowMs int64) {
	if draft.AccountID == "" {
		return
	}
	var senderName, senderEmail string
	_ = db.QueryRow(`SELECT COALESCE(NULLIF(sender_name,''), name), email FROM accounts WHERE id = ?`,
		draft.AccountID).Scan(&senderName, &senderEmail)
	if senderEmail == "" {
		return
	}
	msgID := DraftMessageID(draft.ID)
	tid := "thr-" + msgID
	subj := strings.TrimSpace(draft.Subject)
	if subj == "" {
		subj = "（无主题草稿）"
	}
	snippet := mailproto.MakeSnippet(draft.Body, draft.BodyHTML, 120)
	htmlBody := draft.BodyHTML
	if strings.TrimSpace(htmlBody) == "" {
		htmlBody = security.PlainTextToHTML(draft.Body)
	}
	toAddrs := stringsToEmailAddrs(draft.To)
	ccAddrs := stringsToEmailAddrs(draft.Cc)
	toJ, _ := json.Marshal(toAddrs)
	ccJ, _ := json.Marshal(ccAddrs)
	hasAtt := 0
	if len(draft.Attachments) > 0 {
		hasAtt = 1
	}

	_, _ = db.Exec(`
		INSERT INTO threads(id, account_id, subject, snippet, last_msg_at, msg_count, unread_count, has_star, has_attachment)
		VALUES (?, ?, ?, ?, ?, 1, 0, 0, ?)
		ON CONFLICT(id) DO UPDATE SET subject=excluded.subject, snippet=excluded.snippet, last_msg_at=excluded.last_msg_at, has_attachment=excluded.has_attachment
	`, tid, draft.AccountID, subj, snippet, nowMs, hasAtt)

	_, _ = db.Exec(`
		INSERT INTO messages (
			id, account_id, thread_id, folder, sender_name, sender_email, to_json, cc_json,
			subject, snippet, body_text, body_html_sanitized, sent_at, received_at,
			is_unread, is_starred, has_attachments, size_bytes
		) VALUES (?, ?, ?, 'drafts', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			account_id=excluded.account_id, sender_name=excluded.sender_name, sender_email=excluded.sender_email,
			to_json=excluded.to_json, cc_json=excluded.cc_json, subject=excluded.subject, snippet=excluded.snippet,
			body_text=excluded.body_text, body_html_sanitized=excluded.body_html_sanitized,
			sent_at=excluded.sent_at, received_at=excluded.received_at, has_attachments=excluded.has_attachments, size_bytes=excluded.size_bytes
	`, msgID, draft.AccountID, tid, senderName, senderEmail, string(toJ), string(ccJ),
		subj, snippet, draft.Body, htmlBody, nowMs, nowMs, hasAtt, int64(len(draft.Body)))
}

func extractHeaderValue(rawHeaders, key string) string {
	prefix := strings.ToLower(key) + ":"
	for _, line := range strings.Split(strings.ReplaceAll(rawHeaders, "\r\n", "\n"), "\n") {
		if strings.HasPrefix(strings.ToLower(strings.TrimSpace(line)), prefix) {
			return strings.TrimSpace(line[strings.IndexByte(line, ':')+1:])
		}
	}
	return ""
}

func formatAddrDisplay(name, email string) string {
	email = strings.TrimSpace(email)
	name = strings.TrimSpace(name)
	if name == "" || strings.EqualFold(name, email) {
		return email
	}
	return fmt.Sprintf("%s <%s>", name, email)
}

func appendUniqueRecipient(list []string, item string) []string {
	low := strings.ToLower(item)
	for _, x := range list {
		if strings.ToLower(x) == low {
			return list
		}
	}
	return append(list, item)
}

func stringsToEmailAddrs(items []string) []mailproto.EmailAddress {
	out := make([]mailproto.EmailAddress, 0, len(items))
	for _, s := range items {
		s = strings.TrimSpace(s)
		if s != "" {
			out = append(out, mailproto.EmailAddress{Email: s})
		}
	}
	return out
}

func nonNilStrings(in []string) []string {
	if in == nil {
		return []string{}
	}
	return in
}

func formatBytes(sz int64) string {
	if sz >= 1024*1024 {
		return fmt.Sprintf("%.1f MB", float64(sz)/(1024*1024))
	}
	if sz >= 1024 {
		return fmt.Sprintf("%d KB", (sz+512)/1024)
	}
	return fmt.Sprintf("%d B", sz)
}
