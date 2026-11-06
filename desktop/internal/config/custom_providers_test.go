package config

import (
	"context"
	"encoding/json"
	"omnimail/desktop/internal/domain"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func providerFixture() domain.CustomProvider {
	return domain.CustomProvider{Code: "saved_" + strings.Repeat("a", 32), Name: "团队邮箱",
		IMAP: domain.ProviderServer{Host: "imap.example.invalid", Port: 993, TLSMode: domain.TLSImplicit},
		SMTP: domain.ProviderServer{Host: "smtp.example.invalid", Port: 587, TLSMode: domain.TLSStartTLS}}
}
func TestCustomProvidersPersistenceAndNoSecrets(t *testing.T) {
	dir := t.TempDir()
	store := NewCustomProviders(dir)
	if values, err := store.Load(t.Context()); err != nil || len(values) != 0 {
		t.Fatal("首次应为空")
	}
	want := providerFixture()
	if err := store.Save(t.Context(), []domain.CustomProvider{want}); err != nil {
		t.Fatal(err)
	}
	values, err := NewCustomProviders(dir).Load(t.Context())
	if err != nil || len(values) != 1 || values[0] != want {
		t.Fatal("重载结果不符")
	}
	data, err := os.ReadFile(filepath.Join(dir, customProvidersFile))
	if err != nil {
		t.Fatal(err)
	}
	for _, secret := range []string{"username", "password", "credential", "token", "email"} {
		if strings.Contains(string(data), secret) {
			t.Fatal("模板存在认证字段")
		}
	}
	files, _ := os.ReadDir(dir)
	if len(files) != 1 {
		t.Fatal("临时文件未清理")
	}
}
func TestCustomProvidersRejectCorruptAndSecretFields(t *testing.T) {
	dir := t.TempDir()
	store := NewCustomProviders(dir)
	good, _ := json.Marshal(providerFile{Version: 1, Providers: []domain.CustomProvider{providerFixture()}})
	bad := []string{`{}`, `{"version":2,"providers":[]}`, string(good) + `{}`, strings.Repeat("x", customProvidersMaxBytes+1),
		strings.Replace(string(good), `"host":`, `"password":"private","host":`, 1)}
	for _, value := range bad {
		if err := os.WriteFile(filepath.Join(dir, customProvidersFile), []byte(value), 0o600); err != nil {
			t.Fatal(err)
		}
		if _, err := store.Load(t.Context()); err != domain.ErrProviderStorage {
			t.Fatal("坏文件不能冒充空列表")
		}
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if store.Save(ctx, []domain.CustomProvider{providerFixture()}) == nil {
		t.Fatal("取消不能保存")
	}
	if err := NewCustomProviders(filepath.Join(dir, "private")).Save(t.Context(), nil); err != domain.ErrProviderStorage {
		t.Fatal("存储失败应脱敏")
	}
}
