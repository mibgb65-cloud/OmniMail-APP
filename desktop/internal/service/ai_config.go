package service

import (
	"context"
	"crypto/rand"
	"errors"
	"sync"
	"time"

	"omnimail/desktop/internal/domain"
)

type AI struct {
	reader   domain.TranslationReader
	store    domain.AIStore
	secrets  domain.CredentialStore
	provider domain.AIProvider
	mu       sync.Mutex
	closed   bool
	active   context.CancelFunc
	wg       sync.WaitGroup
	ctx      context.Context
	cancel   context.CancelFunc
	stage    string
	mailID   string
	cooldown time.Time
}

func NewAI(reader domain.TranslationReader, store domain.AIStore, secrets domain.CredentialStore, provider domain.AIProvider) *AI {
	ctx, cancel := context.WithCancel(context.Background())
	return &AI{reader: reader, store: store, secrets: secrets, provider: provider, ctx: ctx, cancel: cancel}
}

func (s *AI) Config(ctx context.Context) (domain.AIConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return domain.AIConfig{}, context.Canceled
	}
	c, err := s.store.ReadAIConfig(ctx)
	return c.Config, err
}

func (s *AI) SaveConfig(ctx context.Context, input domain.AIConfigInput) (domain.AIConfig, error) {
	if input.Validate() != nil {
		return domain.AIConfig{}, domain.ErrAIInput
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return domain.AIConfig{}, context.Canceled
	}
	old, err := s.store.ReadAIConfig(ctx)
	if err != nil {
		return domain.AIConfig{}, err
	}
	endpoint := ""
	if input.Endpoint != "" {
		endpoint, err = domain.NormalizeAIEndpoint(input.Endpoint)
		if err != nil {
			return domain.AIConfig{}, err
		}
	}
	ref := old.CredentialRef
	// 改目的地不得把旧服务的密钥带给新主机，即使输入框留空。
	if input.RemoveKey || endpoint != old.Config.Endpoint {
		ref = ""
	}
	if input.APIKey != "" {
		ref = "omnimail/ai/" + rand.Text()
		if s.secrets.Set(ctx, ref, []byte(input.APIKey)) != nil {
			return domain.AIConfig{}, domain.ErrAIStorage
		}
	}
	c := domain.AIConfig{Endpoint: endpoint, Model: input.Model, Language: input.Language, Consent: input.Consent, HasKey: ref != "", Revision: rand.Text()}
	if err := s.store.WriteAIConfig(ctx, domain.AIStoredConfig{Config: c, CredentialRef: ref}); err != nil {
		if ref != "" && ref != old.CredentialRef {
			return domain.AIConfig{}, errors.Join(domain.ErrAIStorage, s.removeKey(ref))
		}
		return domain.AIConfig{}, domain.ErrAIStorage
	}
	if s.active != nil {
		s.active()
	}
	if old.CredentialRef != "" && old.CredentialRef != ref {
		if err := s.removeKey(old.CredentialRef); err != nil {
			return c, err
		}
	}
	return c, nil
}

func (s *AI) removeKey(ref string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if s.secrets.Delete(ctx, ref) != nil {
		return domain.ErrAIStorage
	}
	return nil
}

func (s *AI) Close() {
	s.mu.Lock()
	s.closed = true
	s.cancel()
	s.mu.Unlock()
	s.wg.Wait()
}
