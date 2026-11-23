package search

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/url"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/mailproto"
	"omnimail/internal/security"
)

var avatarTones = []string{"blue", "indigo", "emerald", "amber", "slate", "rose"}

func GetThreadDetail(db *sql.DB, idOrThreadID string, blockRemoteImages bool) (MailItemDTO, error) {
	var msgID string
	err := db.QueryRow(`SELECT id FROM messages WHERE id = ? LIMIT 1`, idOrThreadID).Scan(&msgID)
	if err != nil {
		err = db.QueryRow(`SELECT id FROM messages WHERE thread_id = ? ORDER BY received_at DESC LIMIT 1`, idOrThreadID).Scan(&msgID)
	}
	if err != nil || msgID == "" {
		return MailItemDTO{}, apperr.New(apperr.CodeNotFound, "未找到对应的邮件或会话记录")
	}
	return GetMessageItem(db, msgID, true, blockRemoteImages)
}

func GetMessageItem(db *sql.DB, msgID string, includeThread bool, blockRemoteImages bool) (MailItemDTO, error) {
	var m MailItemDTO
	var toJ, ccJ, secJ, icsJ, bodyText, bodyHTML string
	var unreadInt, starInt, remImgInt, remAllowInt, aiSumInt int
	var snoozeMs, schedMs int64

	err := db.QueryRow(`
		SELECT m.id, m.thread_id, m.account_id, COALESCE(a.short_tag, ''), COALESCE(a.provider, 'imap'),
		       m.folder, m.sender_name, m.sender_email, m.to_json, m.cc_json, m.subject, m.snippet,
		       m.body_text, m.body_html_sanitized, m.raw_headers, m.received_at,
		       m.is_unread, m.is_starred, m.has_remote_images, m.remote_images_allowed,
		       m.snooze_until, m.scheduled_at, m.outbox_error, m.security_json, m.meeting_invite_json,
		       CASE WHEN m.ai_summarized != 0 THEN 1 ELSE EXISTS (
		           SELECT 1 FROM ai_insights i WHERE i.message_id = m.id AND
		           CASE WHEN json_valid(i.insight_json)
		               THEN json_type(i.insight_json, '$.summary') = 'text'
		                   AND TRIM(json_extract(i.insight_json, '$.summary'), char(9, 10, 13, 32)) != ''
		               ELSE 0 END
		       ) END
		FROM messages m
		LEFT JOIN accounts a ON a.id = m.account_id
		WHERE m.id = ?
	`, msgID).Scan(
		&m.ID, &m.ThreadID, &m.AccountID, &m.AccountTag, &m.Provider,
		&m.Folder, &m.SenderName, &m.SenderEmail, &toJ, &ccJ, &m.Subject, &m.Snippet,
		&bodyText, &bodyHTML, &m.RawHeaders, &m.ReceivedAtUnixMs,
		&unreadInt, &starInt, &remImgInt, &remAllowInt,
		&snoozeMs, &schedMs, &m.OutboxError, &secJ, &icsJ, &aiSumInt,
	)
	if err != nil {
		return MailItemDTO{}, err
	}

	m.Unread = unreadInt != 0
	m.Starred = starInt != 0
	m.HasRemoteImages = remImgInt != 0
	m.AiSummarized = aiSumInt != 0
	m.AvatarText = pickAvatarChar(m.SenderName, m.SenderEmail)
	m.AvatarTone = avatarTones[int(hashStr(m.SenderEmail))%len(avatarTones)]
	m.Recipients = formatAddrJSON(toJ)
	m.Cc = formatAddrJSON(ccJ)
	m.TimeText, m.FullTimeText = formatMailTimes(m.ReceivedAtUnixMs)
	if snoozeMs > 0 {
		m.SnoozeUntil = time.UnixMilli(snoozeMs).Format("01-02 15:04")
	}
	if schedMs > 0 {
		m.ScheduledAt = time.UnixMilli(schedMs).Format("2006-01-02 15:04")
	}
	m.SecurityWarning = decodeSecurityWarning(secJ)
	if icsJ != "" {
		var inv MeetingInviteDTO
		if json.Unmarshal([]byte(icsJ), &inv) == nil && inv.Title != "" {
			m.MeetingInvite = &inv
		}
	}

	m.Labels = queryMessageLabels(db, m.ID)
	m.Attachments = queryMessageAttachments(db, m.ID)

	// DTO 表示实际渲染策略，而不是数据库里仅针对这一封邮件的放行记录。
	highRisk := m.SecurityWarning != nil && m.SecurityWarning.Level == "danger"
	m.RemoteImagesAllowed = (!blockRemoteImages || remAllowInt != 0) && !highRisk
	if !includeThread {
		m.Messages = []ThreadMessageDTO{buildSingleThreadMsg(m.ID, m.SenderName, m.SenderEmail, m.Recipients, m.Cc, m.FullTimeText, bodyText, bodyHTML, m.RemoteImagesAllowed, false)}
		m.RawHeaders = ""
		return m, nil
	}

	tRows, err := db.Query(`
		SELECT id, sender_name, sender_email, to_json, cc_json, sent_at, body_text, body_html_sanitized, remote_images_allowed, security_json
		FROM messages WHERE thread_id = ? ORDER BY sent_at ASC, received_at ASC
	`, m.ThreadID)
	if err != nil {
		m.Messages = []ThreadMessageDTO{buildSingleThreadMsg(m.ID, m.SenderName, m.SenderEmail, m.Recipients, m.Cc, m.FullTimeText, bodyText, bodyHTML, m.RemoteImagesAllowed, false)}
		return m, nil
	}
	defer tRows.Close()
	var list []ThreadMessageDTO
	for tRows.Next() {
		var tid, sName, sEmail, tTo, tCc, tTxt, tHTML, tSecurity string
		var sentAt int64
		var tAllow int
		if tRows.Scan(&tid, &sName, &sEmail, &tTo, &tCc, &sentAt, &tTxt, &tHTML, &tAllow, &tSecurity) == nil {
			_, fullT := formatMailTimes(sentAt)
			warning := decodeSecurityWarning(tSecurity)
			msgAllow := (!blockRemoteImages || tAllow != 0) && !highRisk && (warning == nil || warning.Level != "danger")
			list = append(list, buildSingleThreadMsg(tid, sName, sEmail, formatAddrJSON(tTo), formatAddrJSON(tCc), fullT, tTxt, tHTML, msgAllow, true))
		}
	}
	if len(list) > 0 {
		list[len(list)-1].Collapsed = false
		m.Messages = list
	}
	return m, nil
}

func decodeSecurityWarning(raw string) *SecurityWarningDTO {
	var warning SecurityWarningDTO
	if raw != "" && json.Unmarshal([]byte(raw), &warning) == nil && warning.Level != "" {
		return &warning
	}
	return nil
}

func buildSingleThreadMsg(id, sName, sEmail, to, cc, timeTxt, bodyTxt, bodyHTML string, allowRemote, collapsed bool) ThreadMessageDTO {
	renderedHTML := bodyHTML
	if allowRemote && renderedHTML != "" {
		renderedHTML = security.RestoreRemoteImages(renderedHTML)
	}
	paras := splitParagraphs(bodyTxt)
	if len(paras) == 0 && renderedHTML != "" {
		paras = splitParagraphs(mailproto.StripHTMLToText(renderedHTML))
	}
	return ThreadMessageDTO{
		ID: id, SenderName: sName, SenderEmail: sEmail, Recipients: to, Cc: cc,
		TimeText: timeTxt, BodyParagraphs: paras, BodyHTML: renderedHTML, Collapsed: collapsed,
	}
}

func queryMessageAttachments(db *sql.DB, msgID string) []AttachmentDTO {
	rows, err := db.Query(`
		SELECT id, filename, ext, size_bytes, kind, status, preview_text
		FROM attachments WHERE message_id = ? AND is_inline = 0 ORDER BY rowid ASC
	`, msgID)
	if err != nil {
		return []AttachmentDTO{}
	}
	defer rows.Close()
	out := make([]AttachmentDTO, 0)
	for rows.Next() {
		var a AttachmentDTO
		if rows.Scan(&a.ID, &a.Name, &a.Ext, &a.SizeBytes, &a.Kind, &a.Status, &a.PreviewSummary) == nil {
			a.SizeText = formatBytesText(a.SizeBytes)
			if a.Status == "ready" {
				a.PreviewURL = "/omnimail-attachment/" + url.PathEscape(a.ID)
			}
			out = append(out, a)
		}
	}
	return out
}

func formatBytesText(b int64) string {
	if b >= 1024*1024 {
		return fmt.Sprintf("%.1f MB", float64(b)/(1024*1024))
	}
	if b >= 1024 {
		return fmt.Sprintf("%d KB", (b+512)/1024)
	}
	return fmt.Sprintf("%d B", b)
}
