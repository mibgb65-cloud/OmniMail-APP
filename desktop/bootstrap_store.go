package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"omnimail/internal/profilemgr"
)

// BootstrapConfig 在 %APPDATA%\OmniMail\bootstrap.json 中仅保存 4 个极简引导字段。
type BootstrapConfig struct {
	DataDir         string `json:"dataDir"`
	Initialized     bool   `json:"initialized"`
	ActiveProfileID string `json:"activeProfileId,omitempty"`
	LaunchBehavior  string `json:"launchBehavior,omitempty"`
}

// DesktopPreferences 保存在 getDataDir()/preferences.json，与安装目录完全解耦。
type DesktopPreferences struct {
	ThemePreference   string `json:"themePreference"`
	ResolvedTheme     string `json:"resolvedTheme"`
	Language          string `json:"language"`
	CloseToTray       bool   `json:"closeToTray"`
	LaunchAtStartup   bool   `json:"launchAtStartup"`
	SilentStartToTray bool   `json:"silentStartToTray,omitempty"`
}

type DesktopStateStore struct {
	mu            sync.RWMutex
	configRoot    string
	localRoot     string
	installDir    string
	beforeMigrate func()
	afterMigrate  func() error
}

func newDefaultStateStore() *DesktopStateStore {
	cfgDir, _ := os.UserConfigDir()
	cacheDir, _ := os.UserCacheDir()
	exePath, _ := os.Executable()
	exeDir := ""
	if exePath != "" {
		exeDir = filepath.Clean(filepath.Dir(exePath))
	}
	return &DesktopStateStore{
		configRoot: cfgDir,
		localRoot:  cacheDir,
		installDir: exeDir,
	}
}

func (s *DesktopStateStore) SetMigrationHooks(before func(), after func() error) {
	s.mu.Lock()
	s.beforeMigrate = before
	s.afterMigrate = after
	s.mu.Unlock()
}

func (s *DesktopStateStore) bootstrapFilePath() string {
	base := s.configRoot
	if strings.TrimSpace(base) == "" {
		base = os.TempDir()
	}
	return filepath.Join(base, "OmniMail", "bootstrap.json")
}

func (s *DesktopStateStore) defaultDataDir() string {
	base := s.localRoot
	if strings.TrimSpace(base) == "" {
		base = s.configRoot
	}
	if strings.TrimSpace(base) == "" {
		base = os.TempDir()
	}
	return filepath.Join(base, "OmniMail", "Data")
}

func (s *DesktopStateStore) webviewUserDataDir() string {
	base := s.localRoot
	if strings.TrimSpace(base) == "" {
		base = os.TempDir()
	}
	return filepath.Join(base, "OmniMail", "WebView2")
}

func (s *DesktopStateStore) readBootstrap() BootstrapConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.readBootstrapUnlocked()
}

func (s *DesktopStateStore) readBootstrapUnlocked() BootstrapConfig {
	fallback := BootstrapConfig{
		DataDir:         s.defaultDataDir(),
		Initialized:     false,
		ActiveProfileID: "personal",
		LaunchBehavior:  "last-profile",
	}
	raw, err := os.ReadFile(s.bootstrapFilePath())
	if err != nil {
		return fallback
	}
	raw = []byte(strings.TrimPrefix(string(raw), "\uFEFF"))
	var cfg BootstrapConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return fallback
	}
	cleaned := strings.TrimSpace(cfg.DataDir)
	if cleaned == "" || !filepath.IsAbs(cleaned) {
		cfg.DataDir = fallback.DataDir
	} else {
		cfg.DataDir = filepath.Clean(cleaned)
	}
	if strings.TrimSpace(cfg.ActiveProfileID) == "" {
		cfg.ActiveProfileID = "personal"
	}
	if cfg.LaunchBehavior != "ask-on-launch" {
		cfg.LaunchBehavior = "last-profile"
	}
	return cfg
}

func (s *DesktopStateStore) writeBootstrapUnlocked(cfg BootstrapConfig) error {
	cleaned := strings.TrimSpace(cfg.DataDir)
	if cleaned == "" || !filepath.IsAbs(cleaned) {
		return errors.New("数据目录必须是有效的绝对路径")
	}
	cfg.DataDir = filepath.Clean(cleaned)
	if strings.TrimSpace(cfg.ActiveProfileID) == "" {
		cfg.ActiveProfileID = "personal"
	}
	if cfg.LaunchBehavior != "ask-on-launch" {
		cfg.LaunchBehavior = "last-profile"
	}
	bootPath := s.bootstrapFilePath()
	if err := os.MkdirAll(filepath.Dir(bootPath), 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	tmpPath := bootPath + ".tmp"
	if err := os.WriteFile(tmpPath, raw, 0o600); err != nil {
		return err
	}
	if err := os.Rename(tmpPath, bootPath); err != nil {
		return err
	}
	syncDataDirRegistryHint(cfg.DataDir)
	return nil
}

func (s *DesktopStateStore) ReadBootstrapState() profilemgr.BootstrapState {
	b := s.readBootstrap()
	return profilemgr.BootstrapState{
		DataDir:         b.DataDir,
		Initialized:     b.Initialized,
		ActiveProfileID: b.ActiveProfileID,
		LaunchBehavior:  b.LaunchBehavior,
	}
}

func (s *DesktopStateStore) WriteBootstrapState(next profilemgr.BootstrapState) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.writeBootstrapUnlocked(BootstrapConfig{
		DataDir:         next.DataDir,
		Initialized:     next.Initialized,
		ActiveProfileID: next.ActiveProfileID,
		LaunchBehavior:  next.LaunchBehavior,
	})
}

func (s *DesktopStateStore) getDataDir() string {
	return s.readBootstrap().DataDir
}

func ensureDataLayout(dataDir string) error {
	subdirs := []string{"db", filepath.Join("cache", "mail"), filepath.Join("cache", "attachments"), "index", "exports", "logs", "profiles"}
	for _, sub := range subdirs {
		if err := os.MkdirAll(filepath.Join(dataDir, sub), 0o700); err != nil {
			return err
		}
	}
	return nil
}
