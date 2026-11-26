package main

import (
	"os"
	"strings"

	"omnimail/internal/updater"
)

// 以下构建元数据由打包脚本通过 -ldflags "-X main.AppVersion=... -X main.ReleaseChannel=... -X main.BuildTime=... -X main.ReleaseRepo=..." 单一来源注入。
var (
	AppVersion     = "v0.0.1"
	ReleaseChannel = "stable"
	BuildTime      = "dev"
	ReleaseRepo    = "omnimail-org/omnimail"
)

type AppBuildInfo struct {
	Version   string `json:"version"`
	Channel   string `json:"channel"`
	BuildTime string `json:"buildTime"`
	IsBeta    bool   `json:"isBeta"`
}

func normalizedAppVersion() string {
	return updater.NormalizeVersion(AppVersion)
}

func normalizedReleaseChannel() string {
	return updater.NormalizeChannel(ReleaseChannel, AppVersion)
}

func normalizedReleaseRepo() string {
	if envRepo := strings.TrimSpace(os.Getenv("OMNIMAIL_RELEASE_REPO")); envRepo != "" {
		return strings.Trim(envRepo, "/")
	}
	repo := strings.Trim(strings.TrimSpace(ReleaseRepo), "/")
	if repo == "" {
		return "omnimail-org/omnimail"
	}
	return repo
}

// GetAppBuildInfo 返回当前二进制注入的版本号、发布通道与构建时间，供顶栏与「设置 → 关于」展示。
func (s *DesktopService) GetAppBuildInfo() AppBuildInfo {
	ver := normalizedAppVersion()
	ch := normalizedReleaseChannel()
	bt := strings.TrimSpace(BuildTime)
	if bt == "" {
		bt = "dev"
	}
	return AppBuildInfo{
		Version:   ver,
		Channel:   ch,
		BuildTime: bt,
		IsBeta:    ch == "beta",
	}
}

func isNewerReleaseVersion(current, candidate string) bool {
	return updater.IsNewerVersion(current, candidate)
}
