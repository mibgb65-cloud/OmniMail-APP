package repository

import (
	"context"
	"omnimail/desktop/internal/domain"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestTranslationPreferencesAndCachePersistence(t *testing.T) {
	dir := t.TempDir()
	store := NewTranslationStore(dir)
	prefs, err := store.Preferences(t.Context())
	if err != nil || prefs.Target != "zh" || prefs.Consent {
		t.Fatal("默认授权必须关闭")
	}
	prefs.Consent = true
	if err := store.SavePreferences(t.Context(), prefs); err != nil {
		t.Fatal(err)
	}
	reopened := NewTranslationStore(dir)
	loaded, err := reopened.Preferences(t.Context())
	if err != nil || loaded != prefs {
		t.Fatal("偏好未保存")
	}
	key := strings.Repeat("a", 64)
	value := domain.TranslationResult{MailID: "mail_test", SourceHash: key, Target: "zh", Model: domain.TranslationModel, Subject: "标题", Body: "正文"}
	if err := store.WriteCache(t.Context(), key, value); err != nil {
		t.Fatal(err)
	}
	got, found, err := reopened.ReadCache(t.Context(), key)
	if err != nil || !found || got.Body != "正文" {
		t.Fatal("缓存未保存")
	}
	if _, _, err := store.ReadCache(t.Context(), "../private"); err != domain.ErrTranslationInput {
		t.Fatal("必须拒绝路径")
	}
	if err := os.WriteFile(filepath.Join(dir, "translation-preferences.json"), []byte(`{"private":"secret"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Preferences(t.Context()); err != domain.ErrTranslationStorage {
		t.Fatal("坏文件不能伪装默认授权")
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if err := store.SavePreferences(ctx, prefs); err != context.Canceled {
		t.Fatal("取消不能保存")
	}
}
