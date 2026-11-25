package services

import (
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"github.com/wailsapp/wails/v3/pkg/application"

	"omnimail/internal/apperr"
	"omnimail/internal/mailproto"
	"omnimail/internal/profilemgr"
	"omnimail/internal/workbuddymail"
)

// WorkBuddyMailService 暴露腾讯 WorkBuddy Agent 邮箱原生 REST 接入边界，与常规 IMAP/SMTP 彻底隔离。
type WorkBuddyMailService struct {
	prof *profilemgr.Manager
	mgr  *workbuddymail.Manager
	app  *application.App
	win  *application.WebviewWindow
}

func NewWorkBuddyMailService(prof *profilemgr.Manager, mgr *workbuddymail.Manager) *WorkBuddyMailService {
	return &WorkBuddyMailService{prof: prof, mgr: mgr}
}

func AttachWorkBuddyRuntime(svc *WorkBuddyMailService, app *application.App, win *application.WebviewWindow) {
	if svc == nil {
		return
	}
	svc.app = app
	svc.win = win
}

func (s *WorkBuddyMailService) StartAuth(baseURL string) (workbuddymail.AuthStartResult, error) {
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return workbuddymail.AuthStartResult{}, err
	}
	res, err := s.mgr.StartAuth(sess, baseURL)
	if err != nil {
		return workbuddymail.AuthStartResult{}, err
	}
	if s.app != nil && res.AuthURL != "" {
		_ = s.app.Browser.OpenURL(res.AuthURL)
	}
	return res, nil
}

func (s *WorkBuddyMailService) PollAuthStatus(flowID string) (workbuddymail.AuthPollResult, error) {
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return workbuddymail.AuthPollResult{Stage: workbuddymail.AuthStageIdle}, nil
	}
	return s.mgr.PollAuthStatus(sess, flowID)
}

func (s *WorkBuddyMailService) CancelAuth(flowID string) error {
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return nil
	}
	return s.mgr.CancelAuth(sess, flowID)
}

func (s *WorkBuddyMailService) ConnectAccount(flowID, accountName string) (workbuddymail.AccountDTO, error) {
	trimmed := strings.TrimSpace(accountName)
	if utf8.RuneCountInString(trimmed) > 64 {
		return workbuddymail.AccountDTO{}, apperr.New(apperr.CodeInvalidInput, "账户名称长度不能超过 64 个字符")
	}
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return workbuddymail.AccountDTO{}, err
	}
	return s.mgr.ConnectAccount(sess, flowID, trimmed)
}

func (s *WorkBuddyMailService) DisconnectAccount(accountID string) error {
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return err
	}
	return s.mgr.DisconnectAccount(sess, accountID)
}

func (s *WorkBuddyMailService) GetStatusAndAliases(accountID string) (workbuddymail.StatusAndAliasesDTO, error) {
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return workbuddymail.StatusAndAliasesDTO{Accounts: []workbuddymail.AccountDTO{}}, nil
	}
	return s.mgr.GetStatusAndAliases(sess, accountID)
}

func (s *WorkBuddyMailService) ListMessages(accountID, aliasID, dir, cursor string, limit int) (workbuddymail.MessageListDTO, error) {
	if len(cursor) > 512 {
		return workbuddymail.MessageListDTO{}, apperr.New(apperr.CodeInvalidInput, "分页游标格式无效")
	}
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return workbuddymail.MessageListDTO{}, err
	}
	return s.mgr.ListMessages(sess, accountID, aliasID, dir, cursor, limit)
}

func (s *WorkBuddyMailService) SearchMessages(accountID, aliasID, dir, query, cursor string, limit int) (workbuddymail.MessageListDTO, error) {
	if utf8.RuneCountInString(query) > 256 || len(cursor) > 512 {
		return workbuddymail.MessageListDTO{}, apperr.New(apperr.CodeInvalidInput, "搜索关键词或分页游标格式无效")
	}
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return workbuddymail.MessageListDTO{}, err
	}
	return s.mgr.SearchMessages(sess, accountID, aliasID, dir, query, cursor, limit)
}

func (s *WorkBuddyMailService) GetMessageDetail(accountID, aliasID, messageID string) (workbuddymail.MessageDetailDTO, error) {
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return workbuddymail.MessageDetailDTO{}, err
	}
	return s.mgr.GetMessageDetail(sess, accountID, aliasID, messageID)
}

func (s *WorkBuddyMailService) MarkAsRead(accountID, aliasID, messageID string) error {
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return err
	}
	return s.mgr.MarkAsRead(sess, accountID, aliasID, messageID)
}

func (s *WorkBuddyMailService) DeleteMessage(accountID, aliasID, messageID, confirmationToken string) (workbuddymail.DeleteResultDTO, error) {
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return workbuddymail.DeleteResultDTO{}, err
	}
	return s.mgr.DeleteMessage(sess, accountID, aliasID, messageID, confirmationToken)
}

func (s *WorkBuddyMailService) SaveAttachment(accountID, aliasID, messageID, attachmentID, destPath string) (workbuddymail.AttachmentSaveResultDTO, error) {
	sess, err := s.prof.ActiveSession()
	if err != nil {
		return workbuddymail.AttachmentSaveResultDTO{}, err
	}
	att, err := s.mgr.DownloadAttachment(sess, accountID, aliasID, messageID, attachmentID)
	if err != nil {
		return workbuddymail.AttachmentSaveResultDTO{}, err
	}
	safeName := mailproto.SanitizeFilename(att.Filename)
	outPath := strings.TrimSpace(destPath)
	if outPath == "" {
		if s.app == nil {
			return workbuddymail.AttachmentSaveResultDTO{}, apperr.New(apperr.CodeInvalidInput, "缺少附件保存路径")
		}
		dlg := s.app.Dialog.SaveFile().SetMessage("另存附件").SetFilename(safeName)
		if s.win != nil {
			dlg = dlg.AttachToWindow(s.win)
		}
		chosen, dlgErr := dlg.PromptForSingleSelection()
		if dlgErr != nil || strings.TrimSpace(chosen) == "" {
			return workbuddymail.AttachmentSaveResultDTO{Saved: false, Filename: safeName}, nil
		}
		outPath = chosen
	}
	cleanOut := filepath.Clean(outPath)
	if err := os.MkdirAll(filepath.Dir(cleanOut), 0o700); err != nil {
		return workbuddymail.AttachmentSaveResultDTO{}, apperr.Wrap(apperr.CodeDiskFull, "创建附件保存目录失败", err)
	}
	if err := os.WriteFile(cleanOut, att.Data, 0o600); err != nil {
		return workbuddymail.AttachmentSaveResultDTO{}, apperr.Wrap(apperr.CodeDiskFull, "写入附件文件失败", err)
	}
	return workbuddymail.AttachmentSaveResultDTO{
		Saved:     true,
		SavedPath: cleanOut,
		Filename:  safeName,
		Size:      int64(len(att.Data)),
	}, nil
}
