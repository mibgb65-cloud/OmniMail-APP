package bridge

import (
	"context"
	"omnimail/desktop/internal/domain"
	"omnimail/desktop/internal/service"
)

type TranslationBridge struct{ service *service.Translation }

func NewTranslationBridge(service *service.Translation) *TranslationBridge {
	return &TranslationBridge{service: service}
}
func (b *TranslationBridge) Preferences(ctx context.Context) (domain.TranslationPreferences, error) {
	return b.service.Preferences(ctx)
}
func (b *TranslationBridge) SetPreferences(ctx context.Context, prefs domain.TranslationPreferences) error {
	return b.service.SetPreferences(ctx, prefs)
}
func (b *TranslationBridge) Translate(ctx context.Context, id, target string) (domain.TranslationResult, error) {
	return b.service.Translate(ctx, id, target)
}
func (b *TranslationBridge) Cached(ctx context.Context, id string) (*domain.TranslationResult, error) {
	return b.service.Cached(ctx, id)
}
func (b *TranslationBridge) Progress(ctx context.Context, id string) (service.TranslationProgress, error) {
	return b.service.Progress(ctx, id)
}
