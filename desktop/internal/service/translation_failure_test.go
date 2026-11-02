package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
)

type translationFunc func(context.Context, domain.TranslatedText, string) (domain.TranslatedText, error)

func (f translationFunc) Translate(ctx context.Context, text domain.TranslatedText, target string) (domain.TranslatedText, error) {
	return f(ctx, text, target)
}

func TestTranslationPartialFailureIsNotCached(t *testing.T) {
	s, reader, _ := translationFixture(t)
	reader.detail.Body = strings.Repeat("x", 2200)
	calls := 0
	s.provider = translationFunc(func(context.Context, domain.TranslatedText, string) (domain.TranslatedText, error) {
		calls++
		if calls == 2 {
			return domain.TranslatedText{}, domain.ErrTranslationUnavailable
		}
		return domain.TranslatedText{Subject: "subject", Body: "part"}, nil
	})
	if err := s.SetPreferences(t.Context(), domain.TranslationPreferences{Target: "zh", Consent: true}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Translate(t.Context(), "mail_test", "zh"); !errors.Is(err, domain.ErrTranslationUnavailable) || calls != 2 {
		t.Fatalf("分段失败必须终止：%v / %d", err, calls)
	}
	if cached, err := s.Cached(t.Context(), "mail_test"); err != nil || cached != nil {
		t.Fatalf("部分结果不得进入成功缓存：%v", err)
	}
}

func TestTranslationRevokingConsentCancelsActiveRequest(t *testing.T) {
	s, _, provider := translationFixture(t)
	provider.wait, provider.called = true, make(chan struct{}, 1)
	if err := s.SetPreferences(t.Context(), domain.TranslationPreferences{Target: "zh", Consent: true}); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() { _, err := s.Translate(t.Context(), "mail_test", "zh"); done <- err }()
	select {
	case <-provider.called:
	case <-time.After(3 * time.Second):
		t.Fatal("请求未开始")
	}
	if err := s.SetPreferences(t.Context(), domain.TranslationPreferences{Target: "zh", Consent: false}); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("撤销应取消当前请求：%v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("撤销后请求未停止")
	}
	if _, err := s.Translate(t.Context(), "mail_test", "zh"); !errors.Is(err, domain.ErrTranslationConsent) || provider.calls.Load() != 1 {
		t.Fatal("撤销后不得继续外发")
	}
}
