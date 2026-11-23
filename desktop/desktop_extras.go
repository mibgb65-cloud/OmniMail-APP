package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/events"
)

type PickedFileInfo struct {
	Path      string `json:"path"`
	Name      string `json:"name"`
	SizeBytes int64  `json:"sizeBytes"`
	SizeText  string `json:"sizeText"`
}

type UpdateCheckResult struct {
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	Channel        string `json:"channel"`
	HasUpdate      bool   `json:"hasUpdate"`
	ReleaseURL     string `json:"releaseUrl"`
	ReleaseNotes   string `json:"releaseNotes"`
	CheckedAt      string `json:"checkedAt"`
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

func (s *DesktopService) CheckForUpdates() (UpdateCheckResult, error) {
	nowStr := time.Now().Format("2006-01-02 15:04")
	curVer := normalizedAppVersion()
	channel := normalizedReleaseChannel()
	channelDesc := "稳定版"
	if channel == "beta" {
		channelDesc = "Beta 测试版"
	}
	res := UpdateCheckResult{
		CurrentVersion: curVer,
		LatestVersion:  curVer,
		Channel:        channel,
		HasUpdate:      false,
		ReleaseURL:     "https://github.com/omnimail-org/omnimail/releases",
		ReleaseNotes:   fmt.Sprintf("当前运行的是 OmniMail 开源%s（%s）。", channelDesc, curVer),
		CheckedAt:      nowStr,
	}
	apiURL := strings.TrimSpace(os.Getenv("OMNIMAIL_RELEASE_FEED_URL"))
	if apiURL == "" {
		apiURL = "https://api.github.com/repos/omnimail-org/omnimail/releases/latest"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return res, nil
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "OmniMail-Desktop/"+curVer)
	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		if resp != nil {
			_ = resp.Body.Close()
		}
		return res, nil
	}
	defer resp.Body.Close()
	var gh struct {
		TagName string `json:"tag_name"`
		HTMLURL string `json:"html_url"`
		Body    string `json:"body"`
	}
	if json.NewDecoder(resp.Body).Decode(&gh) == nil && gh.TagName != "" {
		ver := strings.TrimSpace(gh.TagName)
		if ver != "" && !strings.HasPrefix(ver, "v") {
			ver = "v" + ver
		}
		res.LatestVersion = ver
		res.HasUpdate = isNewerReleaseVersion(curVer, ver)
		if gh.HTMLURL != "" {
			res.ReleaseURL = gh.HTMLURL
		}
		if gh.Body != "" {
			res.ReleaseNotes = gh.Body
		}
	}
	return res, nil
}

func (s *DesktopService) SendTestNotification() error {
	showPrivacySystemToast("OmniMail · 隐私桌面通知", "新邮件通知已就绪（默认隐藏邮件正文摘要）")
	app, _ := s.runtimeHandles()
	if app != nil {
		app.Event.Emit(events.DesktopIntent, events.DesktopIntentPayload{
			Type:    "test-notification",
			Payload: "OmniMail 隐私通知通道工作正常（默认隐藏邮件正文摘要）",
		})
	}
	return nil
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
