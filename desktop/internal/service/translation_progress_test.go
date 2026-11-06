package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestTranslationProgressAndLocalRateCooldown(t *testing.T) {
	s, reader, _ := translationFixture(t)
	reader.detail.Body = strings.Repeat("x", 2200)
	if err := s.SetPreferences(t.Context(), domain.TranslationPreferences{Target: "zh", Consent: true}); err != nil {
		t.Fatal(err)
	}
	calls := 0
	s.provider = translationFunc(func(ctx context.Context, text domain.TranslatedText, target string) (domain.TranslatedText, error) {
		calls++
		progress, err := s.Progress(ctx, "mail_test")
		if err != nil || progress.Current != calls || progress.Total != 2 {
			t.Error("分段进度不准确", progress, err)
		}
		return domain.TranslatedText{}, &domain.TranslationRateLimit{Seconds: 2}
	})
	if _, err := s.Translate(t.Context(), "mail_test", "zh"); !errors.Is(err, domain.ErrTranslationRate) {
		t.Fatal(err)
	}
	if _, err := s.Translate(t.Context(), "mail_test", "zh"); !errors.Is(err, domain.ErrTranslationRate) || calls != 1 {
		t.Fatal("冷却期间不得继续外发")
	}
	progress, err := s.Progress(t.Context(), "mail_test")
	if err != nil || progress.RetrySeconds < 1 || progress.RetrySeconds > 2 {
		t.Fatal("缺少冷却提示")
	}
}
