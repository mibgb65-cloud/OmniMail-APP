package bridge

import (
	"context"
	"omnimail/desktop/internal/domain"
	"omnimail/desktop/internal/service"
)

type CustomProvidersBridge struct{ providers *service.CustomProviders }

func NewCustomProvidersBridge(providers *service.CustomProviders) *CustomProvidersBridge {
	return &CustomProvidersBridge{providers: providers}
}
func (b *CustomProvidersBridge) List(ctx context.Context) ([]domain.ProviderPreset, error) {
	return b.providers.List(ctx)
}
func (b *CustomProvidersBridge) Create(ctx context.Context, input service.CustomProviderInput) (domain.ProviderPreset, error) {
	return b.providers.Create(ctx, input)
}
