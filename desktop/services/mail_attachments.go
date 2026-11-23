package services

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"time"

	"omnimail/internal/mailproto"
	"omnimail/internal/search"
	"omnimail/internal/syncer"
)

func (s *MailService) ListLabels() ([]search.MailLabelDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return nil, err
	}
	return search.ListLabels(sess.DB)
}

func (s *MailService) SaveLabel(label search.MailLabelDTO) (search.MailLabelDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return search.MailLabelDTO{}, err
	}
	return search.SaveLabel(sess.DB, label)
}

func (s *MailService) DeleteLabel(id string) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return err
	}
	return search.DeleteLabel(sess.DB, id)
}

func (s *MailService) ApplyLabels(mailIDs, addIDs, removeIDs []string) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return err
	}
	if err := search.ApplyLabels(sess.DB, mailIDs, addIDs, removeIDs); err != nil {
		return err
	}
	s.kickSyncAndEmitDelta(sess, nil, mailIDs, nil)
	return nil
}

func (s *MailService) DownloadAttachment(attachmentID string) (search.AttachmentDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return search.AttachmentDTO{}, err
	}
	cfg, _ := s.mgr.GetAppSettings()
	limitBytes := int64(cfg.AttachmentCacheLimitGb * 1024 * 1024 * 1024)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	return syncer.DownloadAttachment(ctx, sess.DB, sess.Vault, sess.Blobs, s.tokenMgr, s.bus, strings.TrimSpace(attachmentID), limitBytes)
}

func (s *MailService) OpenAttachment(attachmentID string) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return err
	}
	att, err := s.DownloadAttachment(attachmentID)
	if err != nil {
		return err
	}
	var sha string
	_ = sess.DB.QueryRow(`SELECT blob_sha256 FROM attachments WHERE id=?`, att.ID).Scan(&sha)
	srcPath, err := sess.Blobs.AttachmentPath(sha)
	if err != nil {
		return err
	}
	openDir := filepath.Join(sess.ProfileDir, "exports", "opened")
	_ = os.MkdirAll(openDir, 0o700)
	dstPath := filepath.Join(openDir, mailproto.SanitizeFilename(att.Name))
	raw, err := os.ReadFile(srcPath)
	if err != nil {
		return err
	}
	if err := os.WriteFile(dstPath, raw, 0o600); err != nil {
		return err
	}
	if s.app != nil {
		return s.app.Browser.OpenFile(dstPath)
	}
	return nil
}

func (s *MailService) SaveAttachmentAs(attachmentID string) (string, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return "", err
	}
	att, err := s.DownloadAttachment(attachmentID)
	if err != nil {
		return "", err
	}
	var sha string
	_ = sess.DB.QueryRow(`SELECT blob_sha256 FROM attachments WHERE id=?`, att.ID).Scan(&sha)
	srcPath, err := sess.Blobs.AttachmentPath(sha)
	if err != nil {
		return "", err
	}
	target := filepath.Join(sess.ProfileDir, "exports", mailproto.SanitizeFilename(att.Name))
	if s.app != nil {
		dlg := s.app.Dialog.SaveFile().SetMessage("另存附件").SetFilename(mailproto.SanitizeFilename(att.Name))
		if s.win != nil {
			dlg.AttachToWindow(s.win)
		}
		if picked, pErr := dlg.PromptForSingleSelection(); pErr == nil && picked != "" {
			target = picked
		} else {
			return "", nil
		}
	}
	raw, err := os.ReadFile(srcPath)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
		return "", err
	}
	return target, os.WriteFile(target, raw, 0o600)
}
