package service

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"omnimail/desktop/internal/repository"
)

func TestStorageUsageCategories(t *testing.T) {
	dir := t.TempDir()
	files := map[string]int{
		"omnimail.db": 10, "omnimail.db-wal": 20, "omnimail.db-shm": 30,
		"attachments/ab/blob": 40, "attachments/download.tmp": 5,
		"logs/app.log": 50, "backups/old.db": 60, "unknown/file": 70,
		"omnimail.db-fake": 1,
	}
	for name, size := range files {
		target := filepath.Join(dir, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(target, make([]byte, size), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	got, err := NewStorage(dir).Usage(t.Context())
	want := StorageUsage{
		TotalBytes: 286, MailDataBytes: 60, AttachmentsBytes: 45,
		LogsBytes: 50, BackupsBytes: 60, OtherBytes: 71,
	}
	if err != nil || got != want {
		t.Fatalf("统计 = %+v, %v; 期望 %+v", got, err, want)
	}
}

func TestStorageUsageEmptyAndErrors(t *testing.T) {
	got, err := NewStorage(t.TempDir()).Usage(t.Context())
	if err != nil || got != (StorageUsage{}) {
		t.Fatalf("空目录 = %+v, %v", got, err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if _, err := NewStorage(t.TempDir()).Usage(ctx); !errors.Is(err, context.Canceled) {
		t.Fatal("应保留取消语义")
	}
	secretPath := filepath.Join(t.TempDir(), "private-marker")
	for _, dir := range []string{secretPath, "relative", filepath.VolumeName(secretPath) + string(os.PathSeparator)} {
		got, err := NewStorage(dir).Usage(t.Context())
		if err == nil || got != (StorageUsage{}) || strings.Contains(err.Error(), "private-marker") {
			t.Fatal("目录读取失败必须返回安全错误，不返回部分统计")
		}
	}
}

func TestStorageUsageDoesNotFollowLinks(t *testing.T) {
	dir, outside := t.TempDir(), t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "private"), make([]byte, 256), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(dir, "external")); err != nil {
		t.Skip("当前环境无创建符号链接权限")
	}
	if err := os.Symlink(filepath.Join(outside, "private"), filepath.Join(dir, "file")); err != nil {
		t.Fatal(err)
	}
	got, err := NewStorage(dir).Usage(t.Context())
	if err != nil || got.TotalBytes != 0 {
		t.Fatal("不应统计链接目标")
	}
}

func TestStorageUsageWithLiveSQLite(t *testing.T) {
	dir := t.TempDir()
	store, err := repository.Open(t.Context(), dir)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	got, err := NewStorage(dir).Usage(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	var actual int64
	for _, suffix := range []string{"", "-wal", "-shm"} {
		info, err := os.Stat(filepath.Join(dir, "omnimail.db"+suffix))
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			t.Fatal(err)
		}
		actual += info.Size()
	}
	if actual <= 0 || got.MailDataBytes != actual || got.TotalBytes < actual {
		t.Fatalf("打开中的 SQLite 应按实际文件计数: %+v, 实际 %d", got, actual)
	}
}

func TestStorageFileSizeBoundaryAndMissingFile(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "one"), []byte{1}, 0o600); err != nil {
		t.Fatal(err)
	}
	root, err := os.OpenRoot(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer root.Close()
	result := StorageUsage{TotalBytes: 1<<53 - 1}
	if err := addStorageFile(root, "one", &result); err == nil || result.TotalBytes != 1<<53-1 {
		t.Fatal("不能溢出 JavaScript 安全整数")
	}
	if err := addStorageFile(root, "already-rotated.log", &result); err != nil {
		t.Fatal("已轮转消失的文件应被忽略")
	}
}
