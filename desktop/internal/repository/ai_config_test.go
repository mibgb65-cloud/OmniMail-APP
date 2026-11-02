package repository

import (
	"os"
	"path/filepath"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestAIConfigPersistenceAndCorruption(t *testing.T) {
	dir := t.TempDir()
	s := NewAIStore(dir)
	got, err := s.ReadAIConfig(t.Context())
	if err != nil || got.Config.Consent || got.Config.Language != "zh" {
		t.Fatal("默认不得授权")
	}
	c := domain.AIStoredConfig{Config: domain.AIConfig{Endpoint: "https://example.invalid/v1", Model: "test", Language: "zh", Revision: "revision_1"}}
	if err := s.WriteAIConfig(t.Context(), c); err != nil {
		t.Fatal(err)
	}
	got, err = NewAIStore(dir).ReadAIConfig(t.Context())
	if err != nil || got != c {
		t.Fatal("重启后配置未恢复")
	}
	if err := os.WriteFile(filepath.Join(dir, "ai-config.json"), []byte(`{"apiKey":"must-not-leak"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := s.ReadAIConfig(t.Context()); err != domain.ErrAIStorage {
		t.Fatal("不接受未知字段或损坏配置")
	}
}
