package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"omnimail/internal/apperr"
)

var safeProfileIDRegex = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,47}$`)

func DefaultPersonalProfile() ProfileMeta {
	now := time.Now().UTC().Format(time.RFC3339)
	return ProfileMeta{
		ID:              "personal",
		Name:            "个人工作空间",
		Badge:           "个",
		Color:           "#141E2E",
		ThemePreference: "system",
		PinEnabled:      false,
		CreatedAt:       now,
		LastActiveAt:    now,
	}
}

func IsValidProfileID(id string) bool {
	return safeProfileIDRegex.MatchString(strings.TrimSpace(id))
}

func ResolveProfileDir(rootDataDir string, meta ProfileMeta) string {
	if cleaned := strings.TrimSpace(meta.CustomDir); cleaned != "" && filepath.IsAbs(cleaned) {
		return filepath.Clean(cleaned)
	}
	return filepath.Join(rootDataDir, "profiles", meta.ID)
}

func EnsureProfileDirectories(profileDir string) error {
	subdirs := []string{
		filepath.Join("blobs", "raw"),
		filepath.Join("blobs", "attachments"),
		"exports",
		"logs",
	}
	for _, sub := range subdirs {
		if err := os.MkdirAll(filepath.Join(profileDir, sub), 0o700); err != nil {
			return err
		}
	}
	return nil
}

func LoadRegistry(rootDataDir string) (ProfileRegistry, error) {
	path := filepath.Join(rootDataDir, "profiles.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			reg := ProfileRegistry{Version: 1, Profiles: []ProfileMeta{DefaultPersonalProfile()}}
			_ = SaveRegistry(rootDataDir, reg)
			return reg, nil
		}
		return ProfileRegistry{}, err
	}
	raw = []byte(strings.TrimPrefix(string(raw), "\uFEFF"))
	var reg ProfileRegistry
	if err := json.Unmarshal(raw, &reg); err != nil || len(reg.Profiles) == 0 {
		reg = ProfileRegistry{Version: 1, Profiles: []ProfileMeta{DefaultPersonalProfile()}}
		_ = SaveRegistry(rootDataDir, reg)
	}
	return reg, nil
}

func SaveRegistry(rootDataDir string, reg ProfileRegistry) error {
	if len(reg.Profiles) == 0 {
		return apperr.New(apperr.CodeInvalidInput, "至少需要保留一个本地工作空间")
	}
	if reg.Version == 0 {
		reg.Version = 1
	}
	if err := os.MkdirAll(rootDataDir, 0o700); err != nil {
		return err
	}
	path := filepath.Join(rootDataDir, "profiles.json")
	return writeJSONAtomic(path, reg)
}

func LoadProfileSettings(profileDir string) AppSettings {
	def := DefaultAppSettings()
	path := filepath.Join(profileDir, "settings.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		_ = SaveProfileSettings(profileDir, def)
		return def
	}
	var loaded AppSettings
	if err := json.Unmarshal(raw, &loaded); err != nil {
		return def
	}
	loaded.AiApiKeyMasked = ""
	if loaded.SyncIntervalMinutes <= 0 {
		loaded.SyncIntervalMinutes = def.SyncIntervalMinutes
	}
	if loaded.OfflineRetentionDays != 30 && loaded.OfflineRetentionDays != 90 && loaded.OfflineRetentionDays != 180 {
		loaded.OfflineRetentionDays = def.OfflineRetentionDays
	}
	if loaded.UndoSendSeconds != 5 && loaded.UndoSendSeconds != 10 && loaded.UndoSendSeconds != 20 {
		loaded.UndoSendSeconds = def.UndoSendSeconds
	}
	if loaded.AttachmentCacheLimitGb <= 0 {
		loaded.AttachmentCacheLimitGb = def.AttachmentCacheLimitGb
	}
	return loaded
}

func SaveProfileSettings(profileDir string, s AppSettings) error {
	s.AiApiKeyMasked = ""
	if err := os.MkdirAll(profileDir, 0o700); err != nil {
		return err
	}
	return writeJSONAtomic(filepath.Join(profileDir, "settings.json"), s)
}

func writeJSONAtomic(path string, v any) error {
	raw, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
