package service

import (
	"context"
	"errors"
	"time"

	"omnimail/desktop/internal/domain"
)

type AIProgress struct {
	Stage        string `json:"stage"`
	RetrySeconds int    `json:"retrySeconds"`
}

func (s *AI) Progress(ctx context.Context, id string) (AIProgress, error) {
	if !domain.ValidAccountID(id) {
		return AIProgress{}, domain.ErrAIInput
	}
	if ctx.Err() != nil {
		return AIProgress{}, ctx.Err()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return AIProgress{}, context.Canceled
	}
	value := AIProgress{Stage: "idle", RetrySeconds: max(0, int(time.Until(s.cooldown).Seconds()+0.99))}
	if s.mailID == id && s.active != nil {
		value.Stage = s.stage
	}
	return value, nil
}

func (s *AI) begin(parent context.Context, id string) (context.Context, domain.AIStoredConfig, func(), error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil, domain.AIStoredConfig{}, nil, context.Canceled
	}
	if s.active != nil {
		return nil, domain.AIStoredConfig{}, nil, domain.ErrAIBusy
	}
	if time.Now().Before(s.cooldown) {
		return nil, domain.AIStoredConfig{}, nil, domain.ErrAIRate
	}
	ctx, cancel := context.WithTimeout(parent, 120*time.Second)
	config, err := s.store.ReadAIConfig(ctx)
	if err != nil || config.Config.Endpoint == "" || s.provider == nil {
		cancel()
		if err != nil {
			return nil, config, nil, err
		}
		return nil, config, nil, domain.ErrAIConfig
	}
	stop := context.AfterFunc(s.ctx, cancel)
	s.active, s.mailID, s.stage = cancel, id, "preparing"
	s.wg.Add(1)
	return ctx, config, func() {
		stop()
		cancel()
		s.mu.Lock()
		s.active, s.mailID, s.stage = nil, "", ""
		s.mu.Unlock()
		s.wg.Done()
	}, nil
}

func (s *AI) generate(ctx context.Context, c domain.AIStoredConfig, source domain.TranslatedText, request domain.AIRequest) (domain.AIOutput, error) {
	var key []byte
	if c.CredentialRef != "" {
		var err error
		key, err = s.secrets.Get(ctx, c.CredentialRef)
		if err != nil {
			return domain.AIOutput{}, domain.ErrAIStorage
		}
		defer clear(key)
	}
	s.mu.Lock()
	s.stage = "generating"
	s.mu.Unlock()
	output, err := s.provider.Generate(ctx, c.Config, key, source, request)
	var rate *domain.AIRateLimit
	if errors.As(err, &rate) {
		s.mu.Lock()
		s.cooldown = time.Now().Add(time.Duration(max(1, min(rate.Seconds, 300))) * time.Second)
		s.mu.Unlock()
	}
	if ctx.Err() != nil {
		return domain.AIOutput{}, ctx.Err()
	}
	return output, err
}

func (s *AI) TestConnection(parent context.Context) error {
	ctx, config, done, err := s.begin(parent, "connection_test")
	if err != nil {
		return err
	}
	defer done()
	// 该操作不要求邮件外发授权，因为只发送固定合成文本，绝不读取 reader。
	source := domain.TranslatedText{Subject: "Synthetic connection test", Body: "This is a synthetic connection test. No real email is included."}
	output, err := s.generate(ctx, config, source, domain.AIRequest{MailID: "connection_test", Action: "analysis"})
	if err != nil {
		return err
	}
	return output.Validate(source, "analysis")
}
