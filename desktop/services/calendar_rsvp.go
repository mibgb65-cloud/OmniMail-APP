package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/mailproto"
	"omnimail/internal/outbox"
	"omnimail/internal/profilemgr"
	"omnimail/internal/search"
)

type CalendarResponder struct {
	sched *outbox.Scheduler
}

func NewCalendarResponder(sched *outbox.Scheduler) *CalendarResponder {
	return &CalendarResponder{sched: sched}
}

func (c *CalendarResponder) RespondInvite(_ context.Context, sess *profilemgr.Session, mailID, rsvp string) (search.MeetingInviteDTO, error) {
	status := strings.ToLower(strings.TrimSpace(rsvp))
	if status != "accepted" && status != "tentative" && status != "declined" {
		return search.MeetingInviteDTO{}, apperr.New(apperr.CodeInvalidInput, "无效的日程回复状态")
	}

	var accID, subj, rfcID, rawSHA, meetJSON string
	err := sess.DB.QueryRow(`
		SELECT account_id, subject, rfc_message_id, raw_blob_sha256, meeting_invite_json
		FROM messages WHERE id = ?
	`, strings.TrimSpace(mailID)).Scan(&accID, &subj, &rfcID, &rawSHA, &meetJSON)
	if err != nil {
		return search.MeetingInviteDTO{}, apperr.New(apperr.CodeNotFound, "未找到该会议邀请邮件")
	}

	var selfEmail, selfName string
	_ = sess.DB.QueryRow(`SELECT LOWER(email), COALESCE(NULLIF(sender_name,''), name) FROM accounts WHERE id=?`, accID).
		Scan(&selfEmail, &selfName)

	var parsedInv *mailproto.ParsedMeetingInvite
	if rawSHA != "" && sess.Blobs != nil {
		if rawBytes, rErr := sess.Blobs.GetRawEML(rawSHA); rErr == nil {
			if pMail, pErr := mailproto.ParseRawMessage(rawBytes); pErr == nil && pMail.RawICS != "" {
				parsedInv, _ = mailproto.ParseICSInvite(pMail.RawICS, pMail.ICSFilename, selfEmail, pMail.BodyText)
			}
		}
	}
	if parsedInv == nil {
		parsedInv = &mailproto.ParsedMeetingInvite{}
		_ = json.Unmarshal([]byte(meetJSON), parsedInv)
		if parsedInv.Title == "" {
			parsedInv.Title = subj
		}
	}
	parsedInv.RSVP = status
	for i := range parsedInv.Attendees {
		if strings.EqualFold(parsedInv.Attendees[i].Email, selfEmail) {
			parsedInv.Attendees[i].Status = status
		}
	}

	if parsedInv.UID != "" {
		_, _ = sess.DB.Exec(`UPDATE calendar_events SET rsvp_status=? WHERE uid=? AND account_id=?`,
			status, parsedInv.UID, accID)
	}
	updatedJSON, _ := json.Marshal(parsedInv)
	_, _ = sess.DB.Exec(`UPDATE messages SET meeting_invite_json=? WHERE id=?`, string(updatedJSON), mailID)

	if c.sched != nil && parsedInv.OrganizerEmail != "" && !strings.EqualFold(parsedInv.OrganizerEmail, selfEmail) {
		icsReply := mailproto.BuildICSReplyPayload(*parsedInv, selfName, selfEmail, status)
		labelMap := map[string]string{"accepted": "已接受", "tentative": "暂定", "declined": "已婉拒"}
		_, _ = c.sched.EnqueueDirect(sess, accID, mailproto.BuildMessageInput{
			FromName:       selfName,
			FromEmail:      selfEmail,
			To:             []string{parsedInv.OrganizerEmail},
			Subject:        fmt.Sprintf("%s: %s", labelMap[status], parsedInv.Title),
			BodyText:       fmt.Sprintf("%s %s了会议邀请「%s」。", selfName, labelMap[status], parsedInv.Title),
			CalendarICS:    icsReply,
			CalendarMethod: "REPLY",
			InReplyTo:      rfcID,
		})
	}

	var dto search.MeetingInviteDTO
	_ = json.Unmarshal(updatedJSON, &dto)
	if dto.Attendees == nil {
		dto.Attendees = []search.AttendeeDTO{}
	}
	return dto, nil
}

func (c *CalendarResponder) ExportICS(sess *profilemgr.Session, mailID, targetPath string) (string, error) {
	var rawSHA, meetJSON string
	if err := sess.DB.QueryRow(`SELECT raw_blob_sha256, meeting_invite_json FROM messages WHERE id=?`,
		strings.TrimSpace(mailID)).Scan(&rawSHA, &meetJSON); err != nil {
		return "", apperr.New(apperr.CodeNotFound, "未找到该会议邮件")
	}
	var rawICS string
	if rawSHA != "" && sess.Blobs != nil {
		if rawBytes, err := sess.Blobs.GetRawEML(rawSHA); err == nil {
			if pMail, pErr := mailproto.ParseRawMessage(rawBytes); pErr == nil {
				rawICS = pMail.RawICS
			}
		}
	}
	if strings.TrimSpace(rawICS) == "" {
		var inv mailproto.ParsedMeetingInvite
		_ = json.Unmarshal([]byte(meetJSON), &inv)
		rawICS = mailproto.BuildICSReplyPayload(inv, "OmniMail", "user@local", inv.RSVP)
	}
	if strings.TrimSpace(targetPath) == "" {
		expDir := filepath.Join(sess.ProfileDir, "exports")
		_ = os.MkdirAll(expDir, 0o700)
		targetPath = filepath.Join(expDir, fmt.Sprintf("invite-%d.ics", time.Now().Unix()))
	}
	if err := os.WriteFile(targetPath, []byte(rawICS), 0o600); err != nil {
		return "", err
	}
	return targetPath, nil
}
