package config

import (
	"log/slog"
	"path/filepath"
	"strings"
	"testing"
)

func TestFromValues(t *testing.T) {
	home := t.TempDir()
	tests := []struct {
		name, override, level string
		wantDir               string
		wantLevel             slog.Level
		wantError             bool
	}{
		{name: "默认值", wantDir: filepath.Join(home, "OmniMail"), wantLevel: slog.LevelInfo},
		{name: "覆盖目录和级别", override: home, level: "debug", wantDir: home, wantLevel: slog.LevelDebug},
		{name: "警告级别", override: home, level: "warn", wantDir: home, wantLevel: slog.LevelWarn},
		{name: "错误级别", override: home, level: "error", wantDir: home, wantLevel: slog.LevelError},
		{name: "相对路径", override: "../data", wantError: true},
		{name: "磁盘根目录", override: filepath.VolumeName(home) + string(filepath.Separator), wantError: true},
		{name: "路径含控制字符", override: home + "\nsecret", wantError: true},
		{name: "超长路径", override: home + strings.Repeat("a", 4096), wantError: true},
		{name: "非法级别", override: home, level: "verbose", wantError: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := fromValues(home, tt.override, tt.level)
			if (err != nil) != tt.wantError {
				t.Fatalf("错误状态 = %v，预期错误 = %v", err, tt.wantError)
			}
			if !tt.wantError && (got.DataDir != tt.wantDir || got.LogLevel != tt.wantLevel) {
				t.Fatalf("配置 = %+v，预期目录 = %s，级别 = %v", got, tt.wantDir, tt.wantLevel)
			}
		})
	}
}

func TestLoadEnvironment(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("OMNIMAIL_DATA_DIR", dir)
	t.Setenv("OMNIMAIL_LOG_LEVEL", "debug")
	got, err := Load()
	if err != nil || got.DataDir != dir || got.LogLevel != slog.LevelDebug {
		t.Fatalf("环境配置未生效: %+v, %v", got, err)
	}
}
