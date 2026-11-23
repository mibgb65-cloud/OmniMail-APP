package outbox

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
)

func DraftMessageID(draftID string) string {
	return "draftmsg-" + strings.TrimPrefix(draftID, "draftmsg-")
}

// CreateDraft 初始化新建/回复/全部回复/转发草稿，自动应用发件身份锁定与签名注入。
func CreateDraft(db *sql.DB, settings config.AppSettings, req CreateDraftRequest) (ComposeDraftState, error) {
	mode := strings.ToLower(strings.TrimSpace(req.Mode))
	if mode == "" {
		mode = "new"
	}
	rnd := make([]byte, 5)
	_, _ = rand.Read(rnd)
	now := time.Now()
	draft := ComposeDraftState{
		ID:          fmt.Sprintf("draft-%d-%s", now.UnixMilli(), hex.EncodeToString(rnd)),
		Mode:        mode,
		Minimized:   false,
		To:          nonNilStrings(req.PrefillTo),
		Cc:          []string{},
		Bcc:         []string{},
		Subject:     req.Subject,
		Body:        req.Body,
		Attachments: []DraftAttachmentDTO{},
		SavedAt:     now.Format("15:04"),
	}

	if mode == "reply" || mode == "reply-all" || mode == "forward" {
		if err := populateReplyOrForwardDraft(db, settings, req.ReplyToMailID, mode, &draft); err != nil {
			return ComposeDraftState{}, err
		}
	} else {
		accID, err := pickInitialAccountID(db, req.AccountID, settings.DefaultSendAccountID)
		if err != nil {
			return ComposeDraftState{}, err
		}
		draft.AccountID = accID
		draft.LockedAccount = false
	}

	if settings.AutoAppendSignature {
		sig := queryAccountSignature(db, draft.AccountID)
		if strings.TrimSpace(sig) != "" && !strings.Contains(draft.Body, sig) {
			if strings.TrimSpace(draft.Body) == "" {
				draft.Body = "\n\n-- \n" + sig
			} else {
				draft.Body = draft.Body + "\n\n-- \n" + sig
			}
		}
	}
	return SaveDraft(db, draft)
}

// SaveDraft 原子写入草稿并同步更新草稿箱列表镜像记录；若身份已锁定且未经确认切号则拒绝。
func SaveDraft(db *sql.DB, draft ComposeDraftState) (ComposeDraftState, error) {
	draft.ID = strings.TrimPrefix(strings.TrimSpace(draft.ID), "draftmsg-")
	if draft.ID == "" {
		rnd := make([]byte, 5)
		_, _ = rand.Read(rnd)
		draft.ID = fmt.Sprintf("draft-%d-%s", time.Now().UnixMilli(), hex.EncodeToString(rnd))
	}
	if err := VerifyDraftIdentityLock(db, draft.ID, draft.AccountID, draft.UnlockIdentity); err != nil {
		return ComposeDraftState{}, err
	}
	if draft.UnlockIdentity {
		draft.LockedAccount = false
	}
	if draft.Mode == "" {
		draft.Mode = "new"
	}
	draft.To = nonNilStrings(draft.To)
	draft.Cc = nonNilStrings(draft.Cc)
	draft.Bcc = nonNilStrings(draft.Bcc)
	if draft.Attachments == nil {
		draft.Attachments = []DraftAttachmentDTO{}
	}

	now := time.Now()
	nowMs := now.UnixMilli()
	draft.SavedAt = now.Format("15:04")
	draft.UpdatedAtUnixMs = nowMs

	toJ, _ := json.Marshal(draft.To)
	ccJ, _ := json.Marshal(draft.Cc)
	bccJ, _ := json.Marshal(draft.Bcc)
	attJ, _ := json.Marshal(draft.Attachments)
	lockInt := 0
	if draft.LockedAccount {
		lockInt = 1
	}

	_, err := db.Exec(`
		INSERT INTO drafts (
			id, account_id, mode, reply_to_mail_id, locked_account,
			to_json, cc_json, bcc_json, subject, body_text, body_html,
			attachments_json, scheduled_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			account_id=excluded.account_id,
			mode=excluded.mode,
			reply_to_mail_id=excluded.reply_to_mail_id,
			locked_account=excluded.locked_account,
			to_json=excluded.to_json,
			cc_json=excluded.cc_json,
			bcc_json=excluded.bcc_json,
			subject=excluded.subject,
			body_text=excluded.body_text,
			body_html=excluded.body_html,
			attachments_json=excluded.attachments_json,
			scheduled_at=excluded.scheduled_at,
			updated_at=excluded.updated_at
	`,
		draft.ID, draft.AccountID, draft.Mode, draft.ReplyToMailID, lockInt,
		string(toJ), string(ccJ), string(bccJ), draft.Subject, draft.Body, draft.BodyHTML,
		string(attJ), draft.ScheduledAtUnixMs, nowMs,
	)
	if err != nil {
		return ComposeDraftState{}, err
	}
	upsertDraftPreviewMessage(db, draft, nowMs)
	return draft, nil
}

// VerifyDraftIdentityLock 校验被锁定的回复草稿是否在未显式确认解锁的情况下被切换发件账号。
func VerifyDraftIdentityLock(db *sql.DB, draftID, nextAccountID string, unlock bool) error {
	cleanID := strings.TrimPrefix(strings.TrimSpace(draftID), "draftmsg-")
	var origAccID string
	var lockedInt int
	err := db.QueryRow(`SELECT account_id, locked_account FROM drafts WHERE id = ?`, cleanID).Scan(&origAccID, &lockedInt)
	if err != nil {
		return nil
	}
	if lockedInt != 0 && !unlock && nextAccountID != "" && origAccID != "" && nextAccountID != origAccID {
		return apperr.New(apperr.CodeIdentityLocked, "回复草稿已锁定原收件邮箱，如需更换发件身份请先确认解锁")
	}
	return nil
}

func DeleteDraft(db *sql.DB, draftID string) error {
	cleanID := strings.TrimPrefix(strings.TrimSpace(draftID), "draftmsg-")
	msgID := DraftMessageID(cleanID)
	_, _ = db.Exec(`DELETE FROM messages_fts WHERE message_id = ?`, msgID)
	_, _ = db.Exec(`DELETE FROM messages WHERE id = ?`, msgID)
	_, _ = db.Exec(`DELETE FROM threads WHERE id = ?`, "thr-"+msgID)
	_, err := db.Exec(`DELETE FROM drafts WHERE id = ?`, cleanID)
	return err
}
