package bridge

import (
	"context"
	"omnimail/desktop/internal/updater"
)

type UpdatesBridge struct{ manager *updater.Manager }

func NewUpdatesBridge(manager *updater.Manager) *UpdatesBridge {
	return &UpdatesBridge{manager: manager}
}
func (b *UpdatesBridge) State(ctx context.Context) (updater.State, error) {
	return b.manager.Snapshot(), ctx.Err()
}
func (b *UpdatesBridge) SetPreferences(ctx context.Context, prefs updater.Preferences) error {
	return b.manager.SetPreferences(ctx, prefs)
}
func (b *UpdatesBridge) Check(ctx context.Context) error    { return b.manager.Check(ctx) }
func (b *UpdatesBridge) Download(ctx context.Context) error { return b.manager.Download(ctx) }
func (b *UpdatesBridge) Install(ctx context.Context) error  { return b.manager.Install(ctx) }
