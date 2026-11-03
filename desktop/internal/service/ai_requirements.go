package service

import (
	"context"
	"errors"
	"time"

	"omnimail/desktop/internal/domain"
)

// 共用 AI 单任务额度和配置取消链；只有独立授权/收据事务通过后才允许请求模型。
func (s *AI) extractRequirements(parent context.Context, provider domain.RequirementProvider, id, revision string, input domain.RequirementInput, reserve func(context.Context) (bool, error)) (domain.RequirementOutput, bool, error) {
	var empty domain.RequirementOutput
	ctx, config, done, err := s.begin(parent, id)
	if err != nil {
		return empty, false, err
	}
	defer done()
	if config.Config.Revision != revision {
		return empty, false, domain.ErrTaskConfig
	}
	if !config.Config.Consent {
		return empty, false, domain.ErrAIConsent
	}
	var key []byte
	if config.CredentialRef != "" {
		key, err = s.secrets.Get(ctx, config.CredentialRef)
		if err != nil {
			return empty, false, domain.ErrAIStorage
		}
		defer clear(key)
	}
	call, err := reserve(ctx)
	if err != nil || !call {
		return empty, false, err
	}
	if ctx.Err() != nil {
		return empty, true, ctx.Err()
	}
	s.mu.Lock()
	s.stage = "generating"
	s.mu.Unlock()
	output, err := provider.Extract(ctx, config.Config, key, input)
	var rate *domain.AIRateLimit
	if errors.As(err, &rate) {
		s.mu.Lock()
		s.cooldown = time.Now().Add(time.Duration(max(1, min(rate.Seconds, 300))) * time.Second)
		s.mu.Unlock()
	}
	if ctx.Err() != nil {
		return empty, true, ctx.Err()
	}
	if err != nil {
		return empty, true, err
	}
	if output.Validate(input) != nil {
		return empty, true, domain.ErrAIResponse
	}
	return output, true, nil
}
