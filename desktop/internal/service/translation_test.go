package service

import (
	"context"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
	"omnimail/desktop/internal/repository"
)

type translationReader struct{ detail domain.MailDetail }

func (r *translationReader) ReadMail(context.Context, string) (domain.MailDetail, error) {
	return r.detail, nil
}

type translationProvider struct {
	calls  atomic.Int32
	input  domain.TranslatedText
	err    error
	wait   bool
	called chan struct{}
}

func (p *translationProvider) Translate(ctx context.Context, value domain.TranslatedText, target string) (domain.TranslatedText, error) {
	p.calls.Add(1)
	if p.called != nil {
		select {
		case p.called <- struct{}{}:
		default:
		}
	}
	p.input = value
	if p.wait {
		<-ctx.Done()
		return domain.TranslatedText{}, ctx.Err()
	}
	if p.err != nil {
		return domain.TranslatedText{}, p.err
	}
	subject := ""
	if value.Subject != "" {
		subject = "译：" + value.Subject
	}
	return domain.TranslatedText{Subject: subject, Body: "译：" + value.Body}, nil
}
func translationFixture(t *testing.T) (*Translation, *translationReader, *translationProvider) {
	t.Helper()
	reader := &translationReader{domain.MailDetail{MailSummary: domain.MailSummary{ID: "mail_test", AccountID: "account_test", Subject: "subject", Cached: true, From: "private-from", To: "private-to"}, Body: "body", BodyVersion: 1}}
	provider := &translationProvider{}
	service := NewTranslation(reader, repository.NewTranslationStore(t.TempDir()), provider)
	t.Cleanup(service.Close)
	return service, reader, provider
}
func TestTranslationConsentCacheAndProjection(t *testing.T) {
	service, reader, provider := translationFixture(t)
	if cached, err := service.Cached(t.Context(), "mail_test"); err != nil || cached != nil || provider.calls.Load() != 0 {
		t.Fatal("缓存未命中不得访问公网")
	}
	if _, err := service.Translate(t.Context(), "mail_test", "zh"); err != domain.ErrTranslationConsent || provider.calls.Load() != 0 {
		t.Fatal("未授权不得外发")
	}
	if err := service.SetPreferences(t.Context(), domain.TranslationPreferences{Target: "zh", Consent: true}); err != nil {
		t.Fatal(err)
	}
	result, err := service.Translate(t.Context(), "mail_test", "zh")
	if err != nil || result.Subject != "译：subject" || result.Body != "译：body" || result.Cached {
		t.Fatal("首次结果错误", result, err)
	}
	if provider.input.Subject != "subject" || provider.input.Body != "body" {
		t.Fatal("载荷不正确")
	}
	result, err = service.Translate(t.Context(), "mail_test", "zh")
	if err != nil || !result.Cached || provider.calls.Load() != 1 {
		t.Fatal("缓存没有复用")
	}
	cached, err := service.Cached(t.Context(), "mail_test")
	if err != nil || cached == nil || !cached.Cached || provider.calls.Load() != 1 {
		t.Fatal("恢复本地结果不能外发")
	}
	reader.detail.Body = "changed"
	if cached, err := service.Cached(t.Context(), "mail_test"); err != nil || cached != nil || provider.calls.Load() != 1 {
		t.Fatal("源文变化必须不命中且不能自动外发")
	}
	result, err = service.Translate(t.Context(), "mail_test", "zh")
	if err != nil || result.Cached || provider.calls.Load() != 2 {
		t.Fatal("正文改变必须失效")
	}
	if err := service.SetPreferences(t.Context(), domain.TranslationPreferences{Target: "zh", Consent: false}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Translate(t.Context(), "mail_test", "zh"); err != domain.ErrTranslationConsent {
		t.Fatal("撤销必须阻止后续调用")
	}
}
func TestTranslationBodyAndLimits(t *testing.T) {
	service, reader, provider := translationFixture(t)
	if err := service.SetPreferences(t.Context(), domain.TranslationPreferences{Target: "zh", Consent: true}); err != nil {
		t.Fatal(err)
	}
	reader.detail.Body = ""
	reader.detail.RawHTML = `<style>private</style><p>Hello<br/>world</p><img src="https://external.invalid/tracker"><script>private</script>`
	if _, err := service.Translate(t.Context(), "mail_test", "zh"); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(provider.input.Body, "private") || strings.Contains(provider.input.Body, "external") || !strings.Contains(provider.input.Body, "Hello\nworld") {
		t.Fatal("HTML 提取不安全", provider.input)
	}
	reader.detail.BodyErrorCode = "MESSAGE_TEXT_TOO_LARGE"
	if _, err := service.Translate(t.Context(), "mail_test", "zh"); err != domain.ErrTranslationNotReady {
		t.Fatal("不能翻译不完整正文")
	}
	reader.detail.BodyErrorCode = ""
	reader.detail.Body = strings.Repeat("x", 33<<10)
	if _, err := service.Translate(t.Context(), "mail_test", "zh"); err != domain.ErrTranslationTooLarge {
		t.Fatal("必须限制输入")
	}
	if _, err := service.Translate(t.Context(), "../mail", "zh"); err != domain.ErrTranslationInput {
		t.Fatal("必须校验 ID")
	}
}
func TestTranslationCloseCancelsAndBoundsConcurrency(t *testing.T) {
	service, _, provider := translationFixture(t)
	provider.wait = true
	provider.called = make(chan struct{}, 1)
	if err := service.SetPreferences(t.Context(), domain.TranslationPreferences{Target: "zh", Consent: true}); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() { _, err := service.Translate(context.Background(), "mail_test", "zh"); done <- err }()
	select {
	case <-provider.called:
	case <-time.After(3 * time.Second):
		t.Fatal("翻译未开始")
	}
	if _, err := service.Translate(t.Context(), "mail_test", "zh"); err != domain.ErrTranslationBusy {
		t.Fatal("并发必须有界")
	}
	service.Close()
	if err := <-done; err != context.Canceled {
		t.Fatal("关闭必须取消")
	}
}
