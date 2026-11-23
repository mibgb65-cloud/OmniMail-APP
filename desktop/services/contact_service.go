package services

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

	"omnimail/internal/contacts"
	"omnimail/internal/profilemgr"
)

type ContactService struct {
	mgr *profilemgr.Manager
	app *application.App
	win *application.WebviewWindow
}

func NewContactService(mgr *profilemgr.Manager) *ContactService {
	return &ContactService{mgr: mgr}
}

func AttachContactRuntime(s *ContactService, app *application.App, win *application.WebviewWindow) {
	if s == nil {
		return
	}
	s.app = app
	s.win = win
}

func (s *ContactService) ListContacts(query contacts.ContactQuery) ([]contacts.ContactItemDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return nil, err
	}
	return contacts.ListContacts(sess.DB, query)
}

func (s *ContactService) SaveContact(item contacts.ContactItemDTO) (contacts.ContactItemDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return contacts.ContactItemDTO{}, err
	}
	return contacts.SaveContact(sess.DB, item)
}

func (s *ContactService) DeleteContact(id string) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return err
	}
	return contacts.DeleteContact(sess.DB, id)
}

func (s *ContactService) SuggestRecipients(prefix string) ([]contacts.ContactItemDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return nil, err
	}
	return contacts.SuggestRecipients(sess.DB, prefix)
}

func (s *ContactService) ImportVCard() (contacts.VCardImportResult, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return contacts.VCardImportResult{}, err
	}
	if s.app == nil {
		return contacts.VCardImportResult{}, nil
	}
	dlg := s.app.Dialog.OpenFile().
		SetTitle("选择 vCard 联系人文件 (.vcf)").
		CanChooseFiles(true).
		AddFilter("vCard 文件", "*.vcf;*.vcard")
	if s.win != nil {
		dlg.AttachToWindow(s.win)
	}
	chosen, dErr := dlg.PromptForSingleSelection()
	if dErr != nil || chosen == "" {
		return contacts.VCardImportResult{}, nil
	}
	raw, rErr := os.ReadFile(chosen)
	if rErr != nil {
		return contacts.VCardImportResult{}, rErr
	}
	var defAccID string
	_ = sess.DB.QueryRow(`SELECT id FROM accounts ORDER BY is_default DESC, created_at ASC LIMIT 1`).Scan(&defAccID)
	res, iErr := contacts.ImportVCardContent(sess.DB, defAccID, string(raw))
	res.FilePath = chosen
	return res, iErr
}

func (s *ContactService) ExportVCard(contactIDs []string) (string, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return "", err
	}
	content, err := contacts.ExportVCardContent(sess.DB, contactIDs)
	if err != nil {
		return "", err
	}
	defaultName := fmt.Sprintf("contacts-%s.vcf", time.Now().Format("20060102"))
	var target string
	if s.app != nil {
		dlg := s.app.Dialog.SaveFile().SetFilename(defaultName).AddFilter("vCard 文件", "*.vcf")
		if s.win != nil {
			dlg.AttachToWindow(s.win)
		}
		target, _ = dlg.PromptForSingleSelection()
	}
	if target == "" {
		expDir := filepath.Join(sess.ProfileDir, "exports")
		_ = os.MkdirAll(expDir, 0o700)
		target = filepath.Join(expDir, defaultName)
	}
	if err := os.WriteFile(target, []byte(content), 0o600); err != nil {
		return "", err
	}
	return target, nil
}

func (s *ContactService) ListBlacklist() ([]contacts.BlacklistEntryDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return nil, err
	}
	return contacts.ListBlacklist(sess.DB)
}

func (s *ContactService) AddBlacklist(target, kind, reason string) (contacts.BlacklistEntryDTO, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return contacts.BlacklistEntryDTO{}, err
	}
	return contacts.AddBlacklist(sess.DB, target, kind, reason)
}

func (s *ContactService) RemoveBlacklist(id string) error {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return err
	}
	return contacts.RemoveBlacklist(sess.DB, id)
}
