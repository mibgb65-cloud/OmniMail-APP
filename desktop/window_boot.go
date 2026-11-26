package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func isValidThemeMode(theme string) bool {
	return theme == "light" || theme == "dark"
}

func isValidThemePref(pref string) bool {
	return pref == "light" || pref == "dark" || pref == "system"
}

func isValidLanguage(lang string) bool {
	return lang == "zh-CN" || lang == "en-US"
}

func sanitizeUpdateChannel(ch string) string {
	low := strings.ToLower(strings.TrimSpace(ch))
	if low == "beta" {
		return "beta"
	}
	if low == "stable" {
		return "stable"
	}
	return normalizedReleaseChannel()
}

func resolveEffectiveTheme(themePref string) string {
	if themePref == "dark" {
		return "dark"
	}
	if themePref == "light" {
		return "light"
	}
	if detectSystemDarkTheme() {
		return "dark"
	}
	return "light"
}

func defaultDesktopPreferences() DesktopPreferences {
	return DesktopPreferences{
		ThemePreference:  "system",
		ResolvedTheme:    resolveEffectiveTheme("system"),
		Language:         "zh-CN",
		CloseToTray:      true,
		LaunchAtStartup:  false,
		AutoCheckUpdates: true,
		UpdateChannel:    normalizedReleaseChannel(),
	}
}

func sanitizePreferences(in DesktopPreferences) (DesktopPreferences, error) {
	if !isValidThemePref(in.ThemePreference) {
		return DesktopPreferences{}, errors.New("不支持的主题模式")
	}
	if !isValidLanguage(in.Language) {
		return DesktopPreferences{}, errors.New("不支持的界面语言")
	}
	resolved := in.ResolvedTheme
	if in.ThemePreference == "light" || in.ThemePreference == "dark" {
		resolved = in.ThemePreference
	} else if !isValidThemeMode(resolved) {
		resolved = resolveEffectiveTheme("system")
	}
	skipped := strings.TrimSpace(in.SkippedVersion)
	if skipped != "" && !strings.HasPrefix(skipped, "v") && !strings.HasPrefix(skipped, "V") {
		skipped = "v" + skipped
	}
	return DesktopPreferences{
		ThemePreference:   in.ThemePreference,
		ResolvedTheme:     resolved,
		Language:          in.Language,
		CloseToTray:       in.CloseToTray,
		LaunchAtStartup:   in.LaunchAtStartup,
		SilentStartToTray: in.SilentStartToTray,
		AutoCheckUpdates:  in.AutoCheckUpdates,
		UpdateChannel:     sanitizeUpdateChannel(in.UpdateChannel),
		SkippedVersion:    skipped,
		LastUpdateCheckAt: max(0, in.LastUpdateCheckAt),
	}, nil
}

func mergeGeneralPreferences(cur DesktopPreferences, in DesktopPreferences) DesktopPreferences {
	cur.ThemePreference = in.ThemePreference
	cur.ResolvedTheme = in.ResolvedTheme
	cur.Language = in.Language
	cur.CloseToTray = in.CloseToTray
	cur.LaunchAtStartup = in.LaunchAtStartup
	cur.SilentStartToTray = in.SilentStartToTray
	return cur
}

func (s *DesktopStateStore) preferencesFilePath() string {
	return filepath.Join(s.getDataDir(), "preferences.json")
}

func (s *DesktopStateStore) readPreferences() DesktopPreferences {
	def := defaultDesktopPreferences()
	raw, err := os.ReadFile(s.preferencesFilePath())
	if err != nil {
		return def
	}
	loaded := def
	if err := json.Unmarshal(raw, &loaded); err != nil {
		return def
	}
	valid, err := sanitizePreferences(loaded)
	if err != nil {
		return def
	}
	if valid.ThemePreference == "system" {
		valid.ResolvedTheme = resolveEffectiveTheme("system")
	}
	return valid
}

func (s *DesktopStateStore) savePreferences(in DesktopPreferences) (DesktopPreferences, error) {
	valid, err := sanitizePreferences(in)
	if err != nil {
		return DesktopPreferences{}, err
	}
	dataDir := s.getDataDir()
	if err := ensureDataLayout(dataDir); err != nil {
		return DesktopPreferences{}, err
	}
	raw, err := json.MarshalIndent(valid, "", "  ")
	if err != nil {
		return DesktopPreferences{}, err
	}
	prefPath := filepath.Join(dataDir, "preferences.json")
	if err := os.WriteFile(prefPath, raw, 0o600); err != nil {
		return DesktopPreferences{}, err
	}
	return valid, nil
}

// splashWindowBackground 对齐设计稿冷启动首帧背景色（亮 #F8FAFC / 暗 #0B0E14），消除原生窗口白屏闪烁。
func splashWindowBackground(theme string) application.RGBA {
	if theme == "dark" {
		return application.NewRGB(11, 14, 20)
	}
	return application.NewRGB(248, 250, 252)
}

func isSilentAutostart(args []string) bool {
	for _, raw := range args {
		flag := strings.ToLower(strings.TrimSpace(raw))
		if flag == "--autostart" || flag == "--silent" || flag == "--silent-tray" || flag == "--minimized" {
			return true
		}
	}
	return false
}

func shouldHideMainWindowOnBoot(args []string, prefs DesktopPreferences) bool {
	hasAutostart := false
	for _, raw := range args {
		flag := strings.ToLower(strings.TrimSpace(raw))
		if flag == "--silent" || flag == "--silent-tray" || flag == "--minimized" {
			return true
		}
		if flag == "--autostart" {
			hasAutostart = true
		}
	}
	return hasAutostart && prefs.SilentStartToTray
}

func isQuitExistingRequest(args []string) bool {
	for _, raw := range args {
		flag := strings.ToLower(strings.TrimSpace(raw))
		if flag == "--quit-existing" || flag == "--quit" {
			return true
		}
	}
	return false
}
