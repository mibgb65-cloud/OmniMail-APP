package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
	"omnimail/desktop/internal/repository"
)

type failedAIConfigStore struct{ domain.AIStore }

func (s failedAIConfigStore) WriteAIConfig(context.Context, domain.AIStoredConfig) error {
	return domain.ErrAIStorage
}

func TestAIConfigFailedSavePreservesOldKey(t *testing.T) {
	keys := aiSecrets{}
	store := repository.NewAIStore(t.TempDir())
	s := NewAI(nil, store, keys, nil)
	t.Cleanup(s.Close)
	input := aiInput()
	input.APIKey = "synthetic-old-key"
	old, err := s.SaveConfig(t.Context(), input)
	if err != nil {
		t.Fatal(err)
	}
	s.store = failedAIConfigStore{store}
	input.APIKey = "synthetic-new-key"
	if _, err := s.SaveConfig(t.Context(), input); !errors.Is(err, domain.ErrAIStorage) {
		t.Fatal(err)
	}
	if len(keys) != 1 {
		t.Fatal("失败后遗留新密钥或删除旧密钥")
	}
	current, err := store.ReadAIConfig(t.Context())
	if err != nil || current.Config != old || string(keys[current.CredentialRef]) != "synthetic-old-key" {
		t.Fatal("失败破坏旧配置")
	}
}

func TestAIClearCancelsAndPreventsLateCacheWrite(t *testing.T) {
	started, release := make(chan struct{}), make(chan struct{})
	defer func() {
		select {
		case <-release:
		default:
			close(release)
		}
	}()
	s, _ := aiFixture(t, aiProviderFunc(func(context.Context, domain.AIConfig, []byte, domain.TranslatedText, domain.AIRequest) (domain.AIOutput, error) {
		close(started)
		<-release // 模拟不及时响应取消的适配器，服务仍不得保存迟到结果。
		return aiOutput(), nil
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
	if err := s.ClearCache(t.Context()); err != nil {
		t.Fatal(err)
	}
	close(release)
	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Fatal("迟到结果未被取消", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("请求未结束")
	}
	if value, err := s.Cached(t.Context(), "mail_test"); err != nil || value != nil {
		t.Fatal("清理后重新写回旧结果")
	}
}

func TestAIReplyCacheBindsIntentAndRateCooldown(t *testing.T) {
	calls := 0
	s, _ := aiFixture(t, aiProviderFunc(func(_ context.Context, _ domain.AIConfig, _ []byte, _ domain.TranslatedText, r domain.AIRequest) (domain.AIOutput, error) {
		calls++
		if r.Intent == "rate" {
			return domain.AIOutput{}, &domain.AIRateLimit{Seconds: 2}
		}
		output := aiOutput()
		output.Summary, output.Reply = "", "synthetic reply"
		return output, nil
	}))
	if _, err := s.SaveConfig(t.Context(), aiInput()); err != nil {
		t.Fatal(err)
	}
	request := domain.AIRequest{MailID: "mail_test", Action: "reply", Intent: "accept", Tone: "formal"}
	if _, err := s.Run(t.Context(), request); err != nil {
		t.Fatal(err)
	}
	if got, err := s.Run(t.Context(), request); err != nil || !got.Cached || calls != 1 {
		t.Fatal("回复未复用缓存")
	}
	request.Intent = "reject"
	if _, err := s.Run(t.Context(), request); err != nil || calls != 2 {
		t.Fatal("不同意图错误复用旧草稿")
	}
	request.Intent = "rate"
	if _, err := s.Run(t.Context(), request); !errors.Is(err, domain.ErrAIRate) {
		t.Fatal(err)
	}
	if _, err := s.Run(t.Context(), request); !errors.Is(err, domain.ErrAIRate) || calls != 3 {
		t.Fatal("冷却期间继续外发")
	}
}
