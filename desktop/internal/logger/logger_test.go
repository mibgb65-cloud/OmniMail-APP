package logger

import (
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestRedactionAndLevel(t *testing.T) {
	dir := t.TempDir()
	log, closer, err := New(dir, slog.LevelInfo)
	if err != nil {
		t.Fatal(err)
	}
	log.Debug("不应出现的调试消息")
	log.Info("联系 alice@example.com",
		"password", "sensitive-password", "access_token", "sensitive-token",
		slog.Group("account", "email", "private@example.com"),
		"payload", map[string]string{"secret": "nested-secret"},
		"version", "0.1.0")
	if err := closer.Close(); err != nil {
		t.Fatal(err)
	}
	files, err := filepath.Glob(filepath.Join(dir, "logs", "*.log"))
	if err != nil || len(files) != 1 {
		t.Fatalf("日志文件 = %v, %v", files, err)
	}
	data, err := os.ReadFile(files[0])
	if err != nil {
		t.Fatal(err)
	}
	text := string(data)
	for _, secret := range []string{"sensitive-password", "sensitive-token", "alice@example.com", "private@example.com", "nested-secret", "不应出现的调试消息"} {
		if strings.Contains(text, secret) {
			t.Errorf("日志包含未脱敏信息 %q", secret)
		}
	}
	if !strings.Contains(text, `"version":"0.1.0"`) {
		t.Error("正常结构化字段被丢弃")
	}
	if !strings.Contains(text, `"level":"INFO"`) {
		t.Error("日志级别必须保留，不能作为未知对象脱敏")
	}
}

func TestDailyRotationAndClose(t *testing.T) {
	current := time.Date(2026, 10, 22, 23, 59, 0, 0, time.UTC)
	writer := &dailyWriter{dir: t.TempDir(), now: func() time.Time { return current }}
	for _, day := range []string{"2026-10-22", "2026-10-23"} {
		if _, err := writer.Write([]byte(day)); err != nil {
			t.Fatal(err)
		}
		data, err := os.ReadFile(filepath.Join(writer.dir, "app-"+day+".log"))
		if err != nil || string(data) != day {
			t.Fatalf("按日轮转失败: %q, %v", data, err)
		}
		current = current.Add(24 * time.Hour)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal("重复关闭应无副作用")
	}
	if _, err := writer.Write([]byte("closed")); !errors.Is(err, os.ErrClosed) {
		t.Fatalf("关闭后的写入错误 = %v", err)
	}
}

func TestInvalidLogDirectory(t *testing.T) {
	path := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(path, []byte("not a directory"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, _, err := New(path, slog.LevelInfo); err == nil {
		t.Error("数据目录为文件时必须报错")
	}
}
