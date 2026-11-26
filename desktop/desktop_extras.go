package main

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"omnimail/internal/apperr"
)

type PickedFileInfo struct {
	Path      string `json:"path"`
	Name      string `json:"name"`
	SizeBytes int64  `json:"sizeBytes"`
	SizeText  string `json:"sizeText"`
}

func (s *DesktopService) SetLaunchAtLogin(enabled bool, silentToTray bool) error {
	store := s.ensureStore()
	prefs := store.readPreferences()
	prefs.LaunchAtStartup = enabled
	prefs.SilentStartToTray = silentToTray
	if _, err := store.savePreferences(prefs); err != nil {
		return err
	}
	app, _ := s.runtimeHandles()
	syncSystemAutostartWithMode(app, enabled, silentToTray)
	return nil
}

func (s *DesktopService) OpenExternalURL(rawURL string) error {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" || len(trimmed) > 2048 {
		return apperr.New(apperr.CodeInvalidInput, "链接地址无效")
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return apperr.New(apperr.CodeInvalidInput, "链接格式非法")
	}
	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" && scheme != "mailto" {
		return apperr.New(apperr.CodeInvalidInput, "仅允许在系统浏览器打开 http/https/mailto 安全链接")
	}
	app, _ := s.runtimeHandles()
	if app == nil {
		return nil
	}
	return app.Browser.OpenURL(trimmed)
}

func (s *DesktopService) PickLocalFiles(title string, multi bool) ([]PickedFileInfo, error) {
	app, win := s.runtimeHandles()
	if app == nil {
		return nil, apperr.New(apperr.CodeInternal, "当前不处于桌面窗口环境")
	}
	if strings.TrimSpace(title) == "" {
		title = "选择邮件附件"
	}
	dlg := app.Dialog.OpenFile().SetTitle(title).CanChooseFiles(true).CanChooseDirectories(false)
	if win != nil {
		dlg.AttachToWindow(win)
	}
	var paths []string
	if multi {
		picked, err := dlg.PromptForMultipleSelection()
		if err != nil || len(picked) == 0 {
			return []PickedFileInfo{}, nil
		}
		paths = picked
	} else {
		picked, err := dlg.PromptForSingleSelection()
		if err != nil || picked == "" {
			return []PickedFileInfo{}, nil
		}
		paths = []string{picked}
	}
	out := make([]PickedFileInfo, 0, len(paths))
	for _, p := range paths {
		clean := filepath.Clean(p)
		st, err := os.Stat(clean)
		if err != nil || st.IsDir() {
			continue
		}
		out = append(out, PickedFileInfo{
			Path:      clean,
			Name:      filepath.Base(clean),
			SizeBytes: st.Size(),
			SizeText:  formatHumanBytes(st.Size()),
		})
	}
	return out, nil
}

func (s *DesktopService) SendTestNotification(ctx context.Context) error {
	return showPrivacySystemToast(ctx, "OmniMail · 测试通知", "这是一条 Windows 系统通知，不会显示邮件正文。")
}

func formatHumanBytes(b int64) string {
	if b >= 1024*1024 {
		return fmt.Sprintf("%.1f MB", float64(b)/(1024*1024))
	}
	if b >= 1024 {
		return fmt.Sprintf("%d KB", (b+512)/1024)
	}
	return fmt.Sprintf("%d B", b)
}
