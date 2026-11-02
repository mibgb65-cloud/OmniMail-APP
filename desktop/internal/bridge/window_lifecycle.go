package bridge

import (
	"context"
	"omnimail/desktop/internal/service"
)

type WindowLifecycleBridge struct{ lifecycle *service.WindowLifecycle }

func NewWindowLifecycleBridge(lifecycle *service.WindowLifecycle) *WindowLifecycleBridge {
	return &WindowLifecycleBridge{lifecycle: lifecycle}
}
func (b *WindowLifecycleBridge) State(ctx context.Context) (service.WindowCloseState, error) {
	return b.lifecycle.State(ctx)
}
func (b *WindowLifecycleBridge) SetMode(ctx context.Context, mode string) error {
	return b.lifecycle.SetMode(ctx, mode)
}
func (b *WindowLifecycleBridge) Resolve(ctx context.Context, mode string, remember bool) error {
	return b.lifecycle.Resolve(ctx, mode, remember)
}
func (b *WindowLifecycleBridge) Cancel(ctx context.Context) error {
	return b.lifecycle.Cancel(ctx)
}
