package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestAutoSummarySettingDefaultsOffAndPersists(t *testing.T) {
	dir := t.TempDir()
	if DefaultAppSettings().AiAutoSummarizeOnOpen {
		t.Fatal("默认不能自动发送邮件内容")
	}
	if err := os.WriteFile(filepath.Join(dir, "settings.json"), []byte(`{"aiEnabled":true}`), 0o600); err != nil {
		t.Fatal(err)
	}
	legacy := LoadProfileSettings(dir)
	if !legacy.AiEnabled || legacy.AiAutoSummarizeOnOpen {
		t.Fatal("升级已有配置不能隐式开启自动摘要")
	}
	for _, enabled := range []bool{true, false} {
		patched := ApplySettingsPatch(LoadProfileSettings(dir), AppSettingsPatch{AiAutoSummarizeOnOpen: &enabled})
		if err := SaveProfileSettings(dir, patched); err != nil {
			t.Fatal(err)
		}
		if got := LoadProfileSettings(dir); got.AiAutoSummarizeOnOpen != enabled || !got.AiEnabled {
			t.Fatal("持久化自动摘要设置不应改变总开关")
		}
	}
}
