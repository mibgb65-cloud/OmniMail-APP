package services

import (
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/profilemgr"
	"omnimail/internal/storage"
)

type ExportBackupRequest struct {
	TargetZipPath      string `json:"targetZipPath,omitempty"`
	UseSaveDialog      bool   `json:"useSaveDialog,omitempty"`
	IncludeAttachments bool   `json:"includeAttachments"`
	IncludeSecrets     bool   `json:"includeSecrets"`
	ExportPassword     string `json:"exportPassword,omitempty"`
}

type ProfileService struct {
	mgr *profilemgr.Manager
	app *application.App
	win *application.WebviewWindow
}

func NewProfileService(mgr *profilemgr.Manager) *ProfileService {
	return &ProfileService{mgr: mgr}
}

func AttachProfileRuntime(s *ProfileService, app *application.App, win *application.WebviewWindow) {
	if s == nil {
		return
	}
	s.app = app
	s.win = win
}

func (s *ProfileService) ListProfiles() (profilemgr.ProfileListResponse, error) {
	return s.mgr.ListProfiles()
}

func (s *ProfileService) CreateProfile(req profilemgr.CreateProfileRequest) (profilemgr.ProfileSummary, error) {
	return s.mgr.CreateProfile(req)
}

func (s *ProfileService) UpdateProfile(req profilemgr.UpdateProfileRequest) (profilemgr.ProfileSummary, error) {
	return s.mgr.UpdateProfile(req)
}

func (s *ProfileService) SwitchProfile(profileID string, pin string) (profilemgr.ProfileSwitchResult, error) {
	return s.mgr.SwitchProfile(strings.TrimSpace(profileID), pin)
}

func (s *ProfileService) LockProfile(profileID string) error {
	return s.mgr.LockProfile(strings.TrimSpace(profileID))
}

func (s *ProfileService) DeleteProfile(profileID string, deleteLocalFiles bool, pin string) error {
	return s.mgr.DeleteProfile(strings.TrimSpace(profileID), deleteLocalFiles, pin)
}

func (s *ProfileService) ExportProfileBackup(profileID string, req ExportBackupRequest) (string, error) {
	target := strings.TrimSpace(req.TargetZipPath)
	if target == "" && req.UseSaveDialog && s.app != nil {
		dlg := s.app.Dialog.SaveFile().
			SetMessage("导出本地工作空间备份包").
			SetFilename("omnimail-backup.zip")
		if s.win != nil {
			dlg.AttachToWindow(s.win)
		}
		if picked, err := dlg.PromptForSingleSelection(); err == nil && picked != "" {
			target = picked
		}
	}
	return s.mgr.ExportBackup(strings.TrimSpace(profileID), storage.ExportBackupOptions{
		TargetZipPath:      target,
		IncludeAttachments: req.IncludeAttachments,
		IncludeSecrets:     req.IncludeSecrets,
		ExportPassword:     req.ExportPassword,
	})
}

func (s *ProfileService) GetAppSettings() (config.AppSettings, error) {
	return s.mgr.GetAppSettings()
}

func (s *ProfileService) UpdateAppSettings(patch config.AppSettingsPatch) (config.AppSettings, error) {
	if patch.AiProvider != nil || patch.AiModel != nil || patch.AiBaseURL != nil {
		return config.AppSettings{}, apperr.New(apperr.CodeInvalidInput, "请通过 AI 服务配置保存端点和模型")
	}
	return s.mgr.UpdateAppSettings(patch)
}
