package bridge

import (
	"context"
	"errors"

	"omnimail/desktop/internal/domain"
	"omnimail/desktop/internal/service"
)

type AIBridge struct {
	service     *service.AI
	translation *service.Translation
}

func NewAIBridge(s *service.AI, translation *service.Translation) *AIBridge {
	return &AIBridge{service: s, translation: translation}
}
func (b *AIBridge) Config(ctx context.Context) (domain.AIConfig, error) {
	return b.service.Config(ctx)
}
func (b *AIBridge) SaveConfig(ctx context.Context, input domain.AIConfigInput) (domain.AIConfig, error) {
	return b.service.SaveConfig(ctx, input)
}
func (b *AIBridge) TestConnection(ctx context.Context) error { return b.service.TestConnection(ctx) }
func (b *AIBridge) Progress(ctx context.Context, id string) (service.AIProgress, error) {
	return b.service.Progress(ctx, id)
}
func (b *AIBridge) Run(ctx context.Context, request domain.AIRequest) (domain.AIResult, error) {
	return b.service.Run(ctx, request)
}
func (b *AIBridge) Cached(ctx context.Context, id string) (*domain.AIResult, error) {
	return b.service.Cached(ctx, id)
}
func (b *AIBridge) ClearCache(ctx context.Context) error {
	aiErr, translationErr := b.service.ClearCache(ctx), b.translation.ClearCache(ctx)
	if aiErr != nil || translationErr != nil {
		return errors.Join(domain.ErrAIStorage, aiErr, translationErr)
	}
	return nil
}
