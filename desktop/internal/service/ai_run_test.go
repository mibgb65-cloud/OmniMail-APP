package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
	"omnimail/desktop/internal/repository"
)

type aiProviderFunc func(context.Context, domain.AIConfig, []byte, domain.TranslatedText, domain.AIRequest) (domain.AIOutput, error)

func (f aiProviderFunc) Generate(ctx context.Context, c domain.AIConfig, key []byte, text domain.TranslatedText, r domain.AIRequest) (domain.AIOutput, error) {
	return f(ctx, c, key, text, r)
}
func aiOutput() domain.AIOutput {
	return domain.AIOutput{Summary: "synthetic summary", Points: []string{}, Tasks: []domain.AITask{}, Facts: []domain.AIFact{}}
}
func aiFixture(t *testing.T, provider domain.AIProvider) (*AI, *translationReader) {
	t.Helper()
	reader := &translationReader{domain.MailDetail{MailSummary: domain.MailSummary{ID: "mail_test", AccountID: "account_test", Subject: "subject", Cached: true}, Body: "body", BodyVersion: 1}}
	s := NewAI(reader, repository.NewAIStore(t.TempDir()), aiSecrets{}, provider)
	t.Cleanup(s.Close)
	return s, reader
}
func aiInput() domain.AIConfigInput {
	return domain.AIConfigInput{Endpoint: "https://example.invalid/v1", Model: "test", Language: "zh", Consent: true}
}

func TestAIAnalysisConsentProjectionAndLimits(t *testing.T) {
	calls := 0
	provider := aiProviderFunc(func(_ context.Context, c domain.AIConfig, _ []byte, source domain.TranslatedText, _ domain.AIRequest) (domain.AIOutput, error) {
		calls++
		if source.Subject != "subject" || source.Body != "body" {
			t.Error("载荷只应包含指定正文")
		}
		return aiOutput(), nil
	})
	s, reader := aiFixture(t, provider)
	request := domain.AIRequest{MailID: "mail_test", Action: "analysis"}
	if _, err := s.Run(t.Context(), request); !errors.Is(err, domain.ErrAIConfig) || calls != 0 {
		t.Fatal("未配置不得外发")
	}
	input := aiInput()
	input.Consent = false
	if _, err := s.SaveConfig(t.Context(), input); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Run(t.Context(), request); !errors.Is(err, domain.ErrAIConsent) || calls != 0 {
		t.Fatal("未授权不得外发")
	}
	if _, err := s.SaveConfig(t.Context(), aiInput()); err != nil {
		t.Fatal(err)
	}
	result, err := s.Run(t.Context(), request)
	if err != nil || result.MailID != "mail_test" || len(result.SourceHash) != 64 || calls != 1 {
		t.Fatal("分析结果未绑定来源", err)
	}
	reader.detail.Body = strings.Repeat("x", 33<<10)
	if _, err := s.Run(t.Context(), request); !errors.Is(err, domain.ErrAITooLarge) || calls != 1 {
		t.Fatal("超限正文不得上传")
	}
}

func TestAIReconfigurationCancelsAndBoundsConcurrency(t *testing.T) {
	started := make(chan struct{}, 1)
	s, _ := aiFixture(t, aiProviderFunc(func(ctx context.Context, _ domain.AIConfig, _ []byte, _ domain.TranslatedText, _ domain.AIRequest) (domain.AIOutput, error) {
		started <- struct{}{}
		<-ctx.Done()
		return domain.AIOutput{}, ctx.Err()
	}))
	if _, err := s.SaveConfig(t.Context(), aiInput()); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() {
		_, err := s.Run(t.Context(), domain.AIRequest{MailID: "mail_test", Action: "analysis"})
		done <- err
	}()
	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("请求未开始")
	}
	if _, err := s.Run(t.Context(), domain.AIRequest{MailID: "mail_test", Action: "analysis"}); !errors.Is(err, domain.ErrAIBusy) {
		t.Fatal("必须限制并发")
	}
	input := aiInput()
	input.Consent = false
	if _, err := s.SaveConfig(t.Context(), input); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Fatal(err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("设置改变后旧请求未取消")
	}
}

func TestAITestConnectionNeverReadsRealMail(t *testing.T) {
	s, _ := aiFixture(t, aiProviderFunc(func(_ context.Context, _ domain.AIConfig, _ []byte, source domain.TranslatedText, _ domain.AIRequest) (domain.AIOutput, error) {
		if !strings.Contains(source.Body, "synthetic connection test") || source.Subject == "subject" {
			t.Error("连接测试不能使用真实邮件")
		}
		return aiOutput(), nil
	}))
	s.reader = nil
	input := aiInput()
	input.Consent = false
	if _, err := s.SaveConfig(t.Context(), input); err != nil {
		t.Fatal(err)
	}
	if err := s.TestConnection(t.Context()); err != nil {
		t.Fatal(err)
	}
}
