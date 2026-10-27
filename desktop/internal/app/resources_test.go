package app

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"omnimail/desktop/internal/config"
)

func TestResourcesOpenAndClose(t *testing.T) {
	directory := t.TempDir()
	resources, err := openResources(t.Context(), config.Config{DataDir: directory})
	if err != nil {
		t.Fatal(err)
	}
	accounts, readError := resources.storage.ListAccounts(t.Context())
	if readError != nil || len(accounts) != 0 {
		t.Fatalf("应用未初始化空数据库：%v", readError)
	}
	resources.shutdown()
	for range 2 {
		if err := resources.Close(); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := resources.storage.ListAccounts(t.Context()); err == nil {
		t.Fatal("关闭后数据库仍接受读取")
	}
}

func TestResourcesFailureClosesLogger(t *testing.T) {
	directory := t.TempDir()
	if err := os.Mkdir(filepath.Join(directory, "omnimail.db"), 0o700); err != nil {
		t.Fatal(err)
	}
	if _, err := openResources(t.Context(), config.Config{DataDir: directory}); err == nil {
		t.Fatal("无效数据库路径未使启动失败")
	}
	files, err := filepath.Glob(filepath.Join(directory, "logs", "*.log"))
	if err != nil || len(files) == 0 {
		t.Fatalf("未创建测试日志：%v", err)
	}
	for _, file := range files {
		if err := os.Rename(file, file+".closed"); err != nil {
			t.Fatalf("失败启动未释放日志句柄：%v", err)
		}
	}
}

func TestResourcesCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	directory := filepath.Join(t.TempDir(), "not-created")
	if _, err := openResources(ctx, config.Config{DataDir: directory}); !errors.Is(err, context.Canceled) {
		t.Fatalf("启动取消错误丢失：%v", err)
	}
	if _, err := os.Stat(directory); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("取消后仍创建了资源目录")
	}
}
