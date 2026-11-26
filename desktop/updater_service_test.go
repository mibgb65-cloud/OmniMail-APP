//go:build !bindings

package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLegacyPreferencesCompatAndUpdatePrefsIsolation(t *testing.T) {
	root := t.TempDir()
	store := &DesktopStateStore{
		configRoot: filepath.Join(root, "roaming"),
		localRoot:  filepath.Join(root, "local"),
		installDir: filepath.Join(root, "App"),
	}
	svc := NewDesktopService(store, LaunchIntent{})

	dataDir := store.getDataDir()
	if err := ensureDataLayout(dataDir); err != nil {
		t.Fatal(err)
	}
	legacyJSON := `{
  "themePreference": "dark",
  "resolvedTheme": "dark",
  "language": "zh-CN",
  "closeToTray": true,
  "launchAtStartup": false
}`
	if err := os.WriteFile(store.preferencesFilePath(), []byte(legacyJSON), 0o600); err != nil {
		t.Fatal(err)
	}

	initialUpd := svc.GetUpdatePreferences()
	if !initialUpd.AutoCheckUpdates {
		t.Fatalf("旧版无 autoCheckUpdates 字段的配置文件必须默认开启自动检查：%+v", initialUpd)
	}

	updSaved, err := svc.UpdateUpdatePreferences(UpdatePreferencesDTO{
		AutoCheckUpdates: false,
		UpdateChannel:    "beta",
	})
	if err != nil || updSaved.AutoCheckUpdates || updSaved.UpdateChannel != "beta" {
		t.Fatalf("保存自动更新偏好失败：%+v err=%v", updSaved, err)
	}
	if err := svc.SkipUpdateVersion("v0.0.1.beta.19"); err != nil {
		t.Fatalf("记录跳过版本失败：%v", err)
	}

	if _, err := svc.UpdateDesktopPreferences(DesktopPreferences{
		ThemePreference: "light",
		ResolvedTheme:   "light",
		Language:        "en-US",
		CloseToTray:     true,
	}); err != nil {
		t.Fatalf("更新通用偏好失败：%v", err)
	}

	afterPrefs := svc.GetUpdatePreferences()
	if afterPrefs.AutoCheckUpdates || afterPrefs.UpdateChannel != "beta" || afterPrefs.SkippedVersion != "v0.0.1.beta.19" {
		t.Fatalf("更新通用偏好时不应覆盖更新配置：%+v", afterPrefs)
	}
}
