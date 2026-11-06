package service

import (
	"context"
	"errors"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestAICacheRegenerationSourceAndConfigInvalidation(t *testing.T) {
	calls := 0
	s, reader := aiFixture(t, aiProviderFunc(func(context.Context, domain.AIConfig, []byte, domain.TranslatedText, domain.AIRequest) (domain.AIOutput, error) {
		calls++
		return aiOutput(), nil
	}))
	if _, err := s.SaveConfig(t.Context(), aiInput()); err != nil {
		t.Fatal(err)
	}
	if got, err := s.Cached(t.Context(), "mail_test"); err != nil || got != nil || calls != 0 {
		t.Fatal("未命中不得联网")
	}
	r := domain.AIRequest{MailID: "mail_test", Action: "analysis"}
	if got, err := s.Run(t.Context(), r); err != nil || got.Cached {
		t.Fatal(err)
	}
	if got, err := s.Run(t.Context(), r); err != nil || !got.Cached || calls != 1 {
		t.Fatal("未复用缓存", err)
	}
	if got, err := s.Cached(t.Context(), "mail_test"); err != nil || got == nil || !got.Cached || calls != 1 {
		t.Fatal("只读恢复失败", err)
	}
	r.Regenerate = true
	if _, err := s.Run(t.Context(), r); err != nil || calls != 2 {
		t.Fatal("未重新生成", err)
	}
	reader.detail.Body = "changed"
	if got, err := s.Cached(t.Context(), "mail_test"); err != nil || got != nil || calls != 2 {
		t.Fatal("旧正文命中")
	}
	reader.detail.Body = "body"
	if _, err := s.SaveConfig(t.Context(), aiInput()); err != nil {
		t.Fatal(err)
	}
	if got, err := s.Cached(t.Context(), "mail_test"); err != nil || got != nil {
		t.Fatal("旧配置命中")
	}
}

func TestAIFailureNotCachedAndClearKeepsConfig(t *testing.T) {
	s, _ := aiFixture(t, aiProviderFunc(func(context.Context, domain.AIConfig, []byte, domain.TranslatedText, domain.AIRequest) (domain.AIOutput, error) {
		return domain.AIOutput{}, domain.ErrAIUnavailable
	}))
	config, err := s.SaveConfig(t.Context(), aiInput())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Run(t.Context(), domain.AIRequest{MailID: "mail_test", Action: "analysis"}); !errors.Is(err, domain.ErrAIUnavailable) {
		t.Fatal(err)
	}
	if got, err := s.Cached(t.Context(), "mail_test"); err != nil || got != nil {
		t.Fatal("失败被缓存")
	}
	if err := s.ClearCache(t.Context()); err != nil {
		t.Fatal(err)
	}
	current, err := s.Config(t.Context())
	if err != nil || current != config {
		t.Fatal("清理破坏配置")
	}
}
