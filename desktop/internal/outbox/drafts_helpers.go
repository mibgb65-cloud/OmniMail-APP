package outbox

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/mailproto"
)

var reSubjectPrefix = regexp.MustCompile(`^(?i:\s*(?:re|fwd|fw|回复|答复|转发)\s*[:：]\s*)+`)

func GetDraft(db *sql.DB, draftID string) (ComposeDraftState, error) {
	cleanID := strings.TrimPrefix(strings.TrimSpace(draftID), "draftmsg-")
	var d ComposeDraftState
	var lockedInt int
	var toJ, ccJ, bccJ, attJ string
	err := db.QueryRow(`
		SELECT id, account_id, mode, reply_to_mail_id, locked_account,
		       to_json, cc_json, bcc_json, subject, body_text, body_html,
		       attachments_json, scheduled_at, updated_at
		FROM drafts WHERE id = ?
	`, cleanID).Scan(
		&d.ID, &d.AccountID, &d.Mode, &d.ReplyToMailID, &lockedInt,
		&toJ, &ccJ, &bccJ, &d.Subject, &d.Body, &d.BodyHTML,
		&attJ, &d.ScheduledAtUnixMs, &d.UpdatedAtUnixMs,
	)
	if err == sql.ErrNoRows {
		return ComposeDraftState{}, apperr.New(apperr.CodeNotFound, "草稿不存在或已发出")
	}
	if err != nil {
		return ComposeDraftState{}, err
	}
	d.LockedAccount = lockedInt != 0
	_ = json.Unmarshal([]byte(toJ), &d.To)
	_ = json.Unmarshal([]byte(ccJ), &d.Cc)
	_ = json.Unmarshal([]byte(bccJ), &d.Bcc)
	_ = json.Unmarshal([]byte(attJ), &d.Attachments)
	d.To = nonNilStrings(d.To)
	d.Cc = nonNilStrings(d.Cc)
	d.Bcc = nonNilStrings(d.Bcc)
	if d.Attachments == nil {
		d.Attachments = []DraftAttachmentDTO{}
	}
	d.ShowCcBcc = len(d.Cc) > 0 || len(d.Bcc) > 0
	d.SavedAt = time.UnixMilli(d.UpdatedAtUnixMs).Format("15:04")
	return d, nil
}

func ListDrafts(db *sql.DB) ([]ComposeDraftState, error) {
	rows, err := db.Query(`SELECT id FROM drafts ORDER BY updated_at DESC LIMIT 200`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	out := make([]ComposeDraftState, 0, len(ids))
	for _, id := range ids {
		if d, err := GetDraft(db, id); err == nil {
			out = append(out, d)
		}
	}
	return out, nil
}

func populateReplyOrForwardDraft(db *sql.DB, settings config.AppSettings, origMailID, mode string, draft *ComposeDraftState) error {
	var accID, senderName, senderEmail, toJ, ccJ, subj, bodyText, snippet, rawHeaders string
	var sentMs int64
	err := db.QueryRow(`
		SELECT account_id, sender_name, sender_email, to_json, cc_json, subject, body_text, snippet, raw_headers, sent_at
		FROM messages WHERE id = ?
	`, origMailID).Scan(&accID, &senderName, &senderEmail, &toJ, &ccJ, &subj, &bodyText, &snippet, &rawHeaders, &sentMs)
	if err != nil {
		return apperr.New(apperr.CodeNotFound, "未找到被回复的原邮件")
	}

	draft.ReplyToMailID = origMailID
	draft.AccountID = accID
	draft.LockedAccount = settings.LockReplyToOriginalAccount

	var selfEmail string
	_ = db.QueryRow(`SELECT LOWER(email) FROM accounts WHERE id = ?`, accID).Scan(&selfEmail)

	cleanSub := strings.TrimSpace(reSubjectPrefix.ReplaceAllString(subj, ""))
	if mode == "forward" {
		draft.Subject = "Fwd: " + cleanSub
	} else {
		draft.Subject = "Re: " + cleanSub
	}

	replyTarget := extractHeaderValue(rawHeaders, "Reply-To")
	if replyTarget == "" {
		replyTarget = formatAddrDisplay(senderName, senderEmail)
	}
	if mode == "reply" {
		draft.To = []string{replyTarget}
	} else if mode == "reply-all" {
		var origTo, origCc []mailproto.EmailAddress
		_ = json.Unmarshal([]byte(toJ), &origTo)
		_ = json.Unmarshal([]byte(ccJ), &origCc)
		toSet := []string{replyTarget}
		for _, a := range origTo {
			if !strings.EqualFold(a.Email, selfEmail) && a.Email != "" {
				toSet = appendUniqueRecipient(toSet, formatAddrDisplay(a.Name, a.Email))
			}
		}
		var ccSet []string
		for _, a := range origCc {
			if !strings.EqualFold(a.Email, selfEmail) && a.Email != "" {
				ccSet = appendUniqueRecipient(ccSet, formatAddrDisplay(a.Name, a.Email))
			}
		}
		draft.To = toSet
		draft.Cc = ccSet
		draft.ShowCcBcc = len(ccSet) > 0
	} else if mode == "forward" {
		srcText := strings.TrimSpace(bodyText)
		if srcText == "" {
			srcText = snippet
		}
		draft.Body = fmt.Sprintf(
			"\n\n--- 原始邮件 ---\n发件人：%s\n时间：%s\n主题：%s\n\n%s",
			formatAddrDisplay(senderName, senderEmail),
			time.UnixMilli(sentMs).Format("2006-01-02 15:04"),
			subj,
			srcText,
		)
		draft.Attachments = copyReadyAttachments(db, origMailID)
	}
	return nil
}
