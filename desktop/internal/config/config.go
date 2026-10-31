package config

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"unicode"
	"unicode/utf8"
)

type Config struct {
	DataDir  string
	LogLevel slog.Level
}

func Load() (Config, error) {
	override := os.Getenv("OMNIMAIL_DATA_DIR")
	var home string
	if override == "" {
		var err error
		home, err = os.UserConfigDir()
		if err != nil {
			return Config{}, fmt.Errorf("无法获取用户配置目录: %w", err)
		}
	}
	return fromValues(home, override, os.Getenv("OMNIMAIL_LOG_LEVEL"))
}

func fromValues(home, override, level string) (Config, error) {
	dataDir := override
	if dataDir == "" {
		dataDir = filepath.Join(home, "OmniMail")
	}
	if err := validateDataDir(dataDir); err != nil {
		return Config{}, err
	}

	levels := map[string]slog.Level{
		"": slog.LevelInfo, "debug": slog.LevelDebug, "info": slog.LevelInfo,
		"warn": slog.LevelWarn, "error": slog.LevelError,
	}
	logLevel, ok := levels[level]
	if !ok {
		return Config{}, fmt.Errorf("OMNIMAIL_LOG_LEVEL 仅支持 debug、info、warn、error")
	}
	return Config{DataDir: filepath.Clean(dataDir), LogLevel: logLevel}, nil
}

func validateDataDir(path string) error {
	if len(path) > 4096 || !utf8.ValidString(path) ||
		strings.ContainsFunc(path, unicode.IsControl) ||
		strings.HasPrefix(path, `\\.\`) || strings.HasPrefix(path, `\\?\`) {
		return fmt.Errorf("数据目录格式无效，请使用普通绝对路径")
	}
	clean := filepath.Clean(path)
	if !filepath.IsAbs(clean) || filepath.Dir(clean) == clean {
		return fmt.Errorf("数据目录必须是非磁盘根目录的绝对路径")
	}
	return nil
}
