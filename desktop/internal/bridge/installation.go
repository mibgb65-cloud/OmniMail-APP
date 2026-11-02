package bridge

import (
	"context"
	"omnimail/desktop/internal/platform"
)

type InstallationBridge struct{}

func NewInstallationBridge() *InstallationBridge { return &InstallationBridge{} }
func (b *InstallationBridge) Status(ctx context.Context) (platform.InstallationInfo, error) {
	if ctx.Err() != nil {
		return platform.InstallationInfo{}, ctx.Err()
	}
	return platform.Installation()
}
func (b *InstallationBridge) SetAutoStart(ctx context.Context, enabled bool) (platform.InstallationInfo, error) {
	if ctx.Err() != nil {
		return platform.InstallationInfo{}, ctx.Err()
	}
	return platform.SetAutoStart(enabled)
}
func (b *InstallationBridge) InitialLocale(ctx context.Context) (string, error) {
	if ctx.Err() != nil {
		return "", ctx.Err()
	}
	info, err := platform.Installation()
	return info.Locale, err
}
