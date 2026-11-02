package config

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestClosePreferencesRoundTrip(t *testing.T) {
	dir := t.TempDir()
	store := NewClosePreferences(dir)
	if mode, err := store.Load(t.Context()); err != nil || mode != "ask" {
		t.Fatal("首次应询问")
	}
	for _, mode := range []string{"background", "quit", "ask"} {
		if err := store.Save(t.Context(), mode); err != nil {
			t.Fatal(err)
		}
		got, err := NewClosePreferences(dir).Load(t.Context())
		if err != nil || got != mode {
			t.Fatalf("偏好重载 %q: %v", got, err)
		}
	}
	files, err := os.ReadDir(dir)
	if err != nil || len(files) != 1 {
		t.Fatal("不应遗留临时文件")
	}
}

func TestClosePreferencesInvalidAndWriteFailure(t *testing.T) {
	dir := t.TempDir()
	store := NewClosePreferences(dir)
	for _, data := range []string{`{}`, `{"mode":"invalid"}`, strings.Repeat("x", 257), `{"mode":1}`, `{"mode":"quit"} extra`} {
		if err := os.WriteFile(filepath.Join(dir, closePreferencesFile), []byte(data), 0o600); err != nil {
			t.Fatal(err)
		}
		if mode, err := store.Load(t.Context()); err == nil || mode != "ask" {
			t.Fatal("损坏偏好应报告并回退询问")
		}
	}
	if err := store.Save(t.Context(), "../quit"); err == nil {
		t.Fatal("非法输入必须拒绝")
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if err := store.Save(ctx, "quit"); err == nil {
		t.Fatal("取消不能写入")
	}
	if err := NewClosePreferences(filepath.Join(dir, "private-marker")).Save(t.Context(), "quit"); err == nil || strings.Contains(err.Error(), "private-marker") {
		t.Fatal("保存失败不能泄漏路径")
	}
}

func TestClosePreferencesDoesNotFollowExternalLink(t *testing.T) {
	dir, outside := t.TempDir(), t.TempDir()
	target := filepath.Join(outside, "original")
	if err := os.WriteFile(target, []byte(`{"mode":"quit"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(target, filepath.Join(dir, closePreferencesFile)); err != nil {
		t.Skip("无法创建符号链接")
	}
	store := NewClosePreferences(dir)
	if mode, err := store.Load(t.Context()); err == nil || mode != "ask" {
		t.Fatal("不能读取根目录外链接")
	}
	if err := store.Save(t.Context(), "background"); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(target)
	if err != nil || string(data) != `{"mode":"quit"}` {
		t.Fatal("不能修改链接目标")
	}
}
