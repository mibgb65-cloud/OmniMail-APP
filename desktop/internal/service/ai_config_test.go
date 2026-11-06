package service

import (
	"context"
	"errors"
	"testing"

	"omnimail/desktop/internal/domain"
	"omnimail/desktop/internal/repository"
)

type aiSecrets map[string][]byte

func (s aiSecrets) Set(_ context.Context, ref string, key []byte) error {
	s[ref] = append([]byte(nil), key...)
	return nil
}
func (s aiSecrets) Get(_ context.Context, ref string) ([]byte, error) {
	if key, ok := s[ref]; ok {
		return append([]byte(nil), key...), nil
	}
	return nil, domain.ErrCredentialMissing
}
func (s aiSecrets) Delete(_ context.Context, ref string) error { delete(s, ref); return nil }

func TestAIConfigKeyLifecycleAndDestinationChange(t *testing.T) {
	keys := aiSecrets{}
	s := NewAI(nil, repository.NewAIStore(t.TempDir()), keys, nil)
	t.Cleanup(s.Close)
	input := domain.AIConfigInput{Endpoint: "https://example.invalid/v1/", Model: "test", Language: "zh", APIKey: "synthetic-key"}
	c, err := s.SaveConfig(t.Context(), input)
	if err != nil || !c.HasKey || len(keys) != 1 {
		t.Fatalf("密钥未保存 %v", err)
	}
	input.APIKey = ""
	kept, err := s.SaveConfig(t.Context(), input)
	if err != nil || !kept.HasKey || len(keys) != 1 || c.Revision == kept.Revision {
		t.Fatal("空输入应保留同目的地密钥并更新版本")
	}
	input.Endpoint = "https://other.invalid/v1"
	changed, err := s.SaveConfig(t.Context(), input)
	if err != nil || changed.HasKey || len(keys) != 0 {
		t.Fatal("不得把旧密钥交给新目的地")
	}
	input.APIKey, input.RemoveKey = "new-key", true
	if _, err := s.SaveConfig(t.Context(), input); !errors.Is(err, domain.ErrAIInput) {
		t.Fatal("冲突的密钥操作必须拒绝")
	}
}
