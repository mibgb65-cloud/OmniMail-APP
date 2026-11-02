package repository

import (
	"context"
	"strings"

	"omnimail/desktop/internal/domain"
)

// AIStore 复用受限根目录、大小限制和原子替换，不把密钥写入普通文件。
type AIStore struct{ files *TranslationStore }

func NewAIStore(dir string) *AIStore { return &AIStore{files: NewTranslationStore(dir)} }

func validAIConfig(c domain.AIStoredConfig) bool {
	input := domain.AIConfigInput{Endpoint: c.Config.Endpoint, Model: c.Config.Model, Language: c.Config.Language, Consent: c.Config.Consent}
	if input.Validate() != nil || !domain.ValidAccountID(c.Config.Revision) {
		return false
	}
	ref := c.CredentialRef
	return c.Config.HasKey == (ref != "") && (ref == "" ||
		strings.HasPrefix(ref, "omnimail/ai/") && domain.ValidAccountID(strings.TrimPrefix(ref, "omnimail/ai/")))
}

func (s *AIStore) ReadAIConfig(ctx context.Context) (domain.AIStoredConfig, error) {
	s.files.mu.Lock()
	defer s.files.mu.Unlock()
	var value domain.AIStoredConfig
	found, err := s.files.read(ctx, "ai-config.json", 8192, &value)
	if err != nil {
		return value, domain.ErrAIStorage
	}
	if !found {
		return domain.AIStoredConfig{Config: domain.AIConfig{Language: "zh"}}, nil
	}
	if !validAIConfig(value) {
		return domain.AIStoredConfig{}, domain.ErrAIStorage
	}
	return value, nil
}

func (s *AIStore) WriteAIConfig(ctx context.Context, value domain.AIStoredConfig) error {
	if !validAIConfig(value) {
		return domain.ErrAIInput
	}
	s.files.mu.Lock()
	defer s.files.mu.Unlock()
	if s.files.write(ctx, "ai-config.json", value) != nil {
		return domain.ErrAIStorage
	}
	return nil
}
