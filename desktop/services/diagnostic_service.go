package services

import (
	"fmt"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

	"omnimail/internal/diagnostics"
	"omnimail/internal/oauth"
	"omnimail/internal/profilemgr"
)

type DiagnosticService struct {
	mgr      *profilemgr.Manager
	tokenMgr *oauth.TokenManager
	app      *application.App
	win      *application.WebviewWindow
}

func NewDiagnosticService(mgr *profilemgr.Manager, tm *oauth.TokenManager) *DiagnosticService {
	if tm == nil {
		tm = oauth.NewTokenManager()
	}
	return &DiagnosticService{mgr: mgr, tokenMgr: tm}
}

func AttachDiagnosticRuntime(s *DiagnosticService, app *application.App, win *application.WebviewWindow) {
	if s == nil {
		return
	}
	s.app = app
	s.win = win
}

func (s *DiagnosticService) RunAccountDiagnostics(accountID string) (diagnostics.DiagnosticReport, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return diagnostics.DiagnosticReport{}, err
	}
	return diagnostics.RunAccountDiagnostics(sess.Ctx, sess, s.tokenMgr, accountID)
}

func (s *DiagnosticService) ListSyncLogs(filter diagnostics.SyncLogFilter) ([]diagnostics.SyncLogEntry, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return nil, err
	}
	return diagnostics.ListSyncLogs(sess.DB, filter)
}

func (s *DiagnosticService) GetMessageRawSource(mailID string) (diagnostics.RawSourceView, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return diagnostics.RawSourceView{}, err
	}
	return diagnostics.GetMessageRawSource(sess, mailID)
}

func (s *DiagnosticService) GetStorageBreakdown() (diagnostics.StorageBreakdown, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return diagnostics.StorageBreakdown{}, err
	}
	return diagnostics.GetStorageBreakdown(sess), nil
}

func (s *DiagnosticService) ClearAttachmentCache() (int64, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return 0, err
	}
	return diagnostics.ClearAttachmentCache(sess)
}

func (s *DiagnosticService) ExportDiagnosticBundle() (string, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return "", err
	}
	defaultName := fmt.Sprintf("omnimail-diag-%s.zip", time.Now().Format("20060102-150405"))
	var target string
	if s.app != nil {
		dlg := s.app.Dialog.SaveFile().SetFilename(defaultName).AddFilter("ZIP 诊断压缩包", "*.zip")
		if s.win != nil {
			dlg.AttachToWindow(s.win)
		}
		target, _ = dlg.PromptForSingleSelection()
	}
	return diagnostics.ExportDiagnosticBundle(sess, target)
}
