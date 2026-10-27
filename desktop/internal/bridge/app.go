package bridge

import (
	"context"
	"runtime"
)

// 构建任务通过 -ldflags 注入提交号和时间；直接 go run 时保留明确的开发值。
var (
	Version   = "0.1.0-dev"
	Commit    = "unknown"
	BuildTime = "unknown"
)

type VersionInfo struct {
	Version   string `json:"version"`
	Commit    string `json:"commit"`
	BuildTime string `json:"buildTime"`
	GoVersion string `json:"goVersion"`
	Platform  string `json:"platform"`
}

type AppBridge struct{}

func NewAppBridge() *AppBridge {
	return &AppBridge{}
}

func (b *AppBridge) Version(ctx context.Context) (VersionInfo, error) {
	if err := ctx.Err(); err != nil {
		return VersionInfo{}, err
	}
	return VersionInfo{
		Version: Version, Commit: Commit, BuildTime: BuildTime,
		GoVersion: runtime.Version(), Platform: runtime.GOOS + "/" + runtime.GOARCH,
	}, nil
}
