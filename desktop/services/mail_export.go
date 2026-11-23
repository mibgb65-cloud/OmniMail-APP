package services

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/events"
	"omnimail/internal/mailproto"
	"omnimail/internal/profilemgr"
	"omnimail/internal/search"
)

func (s *MailService) RespondMeetingInvite(mailID string, rsvp string) (search.MeetingInviteDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return search.MeetingInviteDTO{}, err
	}
	if s.rsvp == nil {
		return search.MeetingInviteDTO{}, apperr.New(apperr.CodeInternal, "日程回复处理器未就绪")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	return s.rsvp.RespondInvite(ctx, sess, strings.TrimSpace(mailID), strings.TrimSpace(rsvp))
}

func (s *MailService) ExportMeetingICS(mailID string) (string, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return "", err
	}
	target := ""
	if s.app != nil {
		dlg := s.app.Dialog.SaveFile().SetMessage("导出日程邀请 .ics").SetFilename("invite.ics")
		if s.win != nil {
			dlg.AttachToWindow(s.win)
		}
		if picked, pErr := dlg.PromptForSingleSelection(); pErr == nil {
			target = picked
		}
	}
	if s.rsvp != nil {
		return s.rsvp.ExportICS(sess, strings.TrimSpace(mailID), target)
	}
	return "", apperr.New(apperr.CodeNotFound, "该邮件不包含日程邀请数据")
}

func (s *MailService) ExportMessageEML(mailID string) (string, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return "", err
	}
	var subject, sha, rawHeaders, bodyTxt string
	if err := sess.DB.QueryRow(`SELECT subject, raw_blob_sha256, raw_headers, body_text FROM messages WHERE id=?`, strings.TrimSpace(mailID)).
		Scan(&subject, &sha, &rawHeaders, &bodyTxt); err != nil {
		return "", apperr.New(apperr.CodeNotFound, "未找到对应的邮件")
	}
	var eml []byte
	if sha != "" {
		eml, _ = sess.Blobs.GetRawEML(sha)
	}
	if len(eml) == 0 {
		eml = []byte(rawHeaders + "\r\n\r\n" + bodyTxt)
	}
	fn := mailproto.SanitizeFilename(subject) + ".eml"
	target := filepath.Join(sess.ProfileDir, "exports", fn)
	if s.app != nil {
		dlg := s.app.Dialog.SaveFile().SetMessage("导出原始邮件 .eml").SetFilename(fn)
		if s.win != nil {
			dlg.AttachToWindow(s.win)
		}
		if picked, pErr := dlg.PromptForSingleSelection(); pErr == nil && picked != "" {
			target = picked
		} else {
			return "", nil
		}
	}
	_ = os.MkdirAll(filepath.Dir(target), 0o700)
	return target, os.WriteFile(target, eml, 0o600)
}

func (s *MailService) ExportFolderMBOX(folder string) (string, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return "", err
	}
	f := strings.TrimSpace(folder)
	if f == "" {
		f = "inbox"
	}
	rows, err := sess.DB.Query(`SELECT sender_email, sent_at, raw_blob_sha256, raw_headers, body_text FROM messages WHERE folder=? ORDER BY sent_at ASC`, f)
	if err != nil {
		return "", err
	}
	defer rows.Close()
	var buf bytes.Buffer
	for rows.Next() {
		var sender, sha, hdr, txt string
		var sentMs int64
		if rows.Scan(&sender, &sentMs, &sha, &hdr, &txt) == nil {
			if sender == "" {
				sender = "MAILER-DAEMON"
			}
			ts := time.UnixMilli(sentMs).UTC().Format(time.ANSIC)
			fmt.Fprintf(&buf, "From %s %s\r\n", sender, ts)
			raw, _ := sess.Blobs.GetRawEML(sha)
			if len(raw) == 0 {
				raw = []byte(hdr + "\r\n\r\n" + txt)
			}
			buf.Write(raw)
			buf.WriteString("\r\n\r\n")
		}
	}
	fn := fmt.Sprintf("omnimail-%s-%s.mbox", f, time.Now().Format("20060102"))
	target := filepath.Join(sess.ProfileDir, "exports", fn)
	if s.app != nil {
		dlg := s.app.Dialog.SaveFile().SetMessage("导出文件夹归档 .mbox").SetFilename(fn)
		if s.win != nil {
			dlg.AttachToWindow(s.win)
		}
		if picked, pErr := dlg.PromptForSingleSelection(); pErr == nil && picked != "" {
			target = picked
		} else {
			return "", nil
		}
	}
	_ = os.MkdirAll(filepath.Dir(target), 0o700)
	return target, os.WriteFile(target, buf.Bytes(), 0o600)
}

func (s *MailService) kickSyncAndEmitDelta(sess *profilemgr.Session, accs, updatedIDs, removedIDs []string) {
	if s.syncer != nil {
		for _, aid := range accs {
			_ = s.syncer.TriggerSync(aid)
		}
	}
	if s.bus != nil {
		counts, _ := search.GetFolderCounts(sess.DB, "")
		s.bus.Emit(events.MailDelta, events.MailDeltaPayload{
			UpdatedIDs: updatedIDs, RemovedIDs: removedIDs, FolderCounts: counts.Counts,
		})
	}
}
