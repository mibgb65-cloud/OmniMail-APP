package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestTranslationDefaultsAndProfilePersistence(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "settings.json"), []byte(`{"aiEnabled":false}`), 0o600); err != nil {
		t.Fatal(err)
	}
	settings := LoadProfileSettings(dir)
	if !settings.TranslationEnabled || settings.TranslationProvider != "bilibili" ||
		settings.TranslationEndpoint != "https://api.bilibili.com/x/intl/translate/v2" ||
		settings.TranslationTimeoutSec != 8 || settings.AiEnabled || settings.AiAutoSummarizeOnOpen {
		t.Fatal("旧工作空间应默认获得独立的免密翻译")
	}
	enabled, provider, endpoint, timeout := false, "ai", "https://example.test/v1", 12
	patch := AppSettingsPatch{TranslationEnabled: &enabled, TranslationProvider: &provider, TranslationEndpoint: &endpoint, TranslationTimeoutSec: &timeout}
	if err := ValidateTranslationSettingsPatch(patch); err != nil {
		t.Fatal(err)
	}
	if err := SaveProfileSettings(dir, ApplySettingsPatch(settings, patch)); err != nil {
		t.Fatal(err)
	}
	got := LoadProfileSettings(dir)
	if got.TranslationEnabled || got.TranslationProvider != provider || got.TranslationEndpoint != endpoint ||
		got.TranslationTimeoutSec != timeout || got.AiAutoSummarizeOnOpen || !got.AiRequireConfirmEachTime {
		t.Fatal("翻译设置未正确持久化")
	}
}

func TestTranslationSettingsValidation(t *testing.T) {
	for _, endpoint := range []string{"", "ftp://example.test", "https://u:p@example.test/path", "http://example.test/?token=example",
		"http://example.test/#path", "http://example.test:65536/", "https:///no-host"} {
		if err := ValidateTranslationSettingsPatch(AppSettingsPatch{TranslationEndpoint: &endpoint}); err == nil {
			t.Errorf("应拒绝非法翻译地址 %q", endpoint)
		}
	}
	provider, timeout := "unknown", 31
	if ValidateTranslationSettingsPatch(AppSettingsPatch{TranslationProvider: &provider}) == nil ||
		ValidateTranslationSettingsPatch(AppSettingsPatch{TranslationTimeoutSec: &timeout}) == nil {
		t.Fatal("不应接受未知提供商或超出范围的超时")
	}
}
