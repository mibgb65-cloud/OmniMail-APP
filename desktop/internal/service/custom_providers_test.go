package service

import (
	"context"
	"errors"
	"fmt"
	"omnimail/desktop/internal/config"
	"omnimail/desktop/internal/domain"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func templateInput() CustomProviderInput {
	return CustomProviderInput{Name: "公司邮件",
		IMAP: domain.ProviderServer{Host: "imap.example.invalid", Port: 993, TLSMode: domain.TLSImplicit},
		SMTP: domain.ProviderServer{Host: "smtp.example.invalid", Port: 587, TLSMode: domain.TLSStartTLS}}
}
func TestCustomProvidersCreateAndReload(t *testing.T) {
	dir := t.TempDir()
	service := NewCustomProviders(config.NewCustomProviders(dir))
	input := templateInput()
	input.Name = " 公司邮件 "
	input.IMAP.Host = " IMAP.EXAMPLE.INVALID "
	created, err := service.Create(t.Context(), input)
	if err != nil {
		t.Fatal(err)
	}
	if created.Name != "公司邮件" || created.Endpoints[0].Host != "imap.example.invalid" {
		t.Fatal("未规范化")
	}
	values, err := NewCustomProviders(config.NewCustomProviders(dir)).List(t.Context())
	if err != nil || len(values) != 1 || values[0].Code != created.Code {
		t.Fatal("创建后未持久化")
	}
	if _, err := service.Create(t.Context(), templateInput()); !errors.Is(err, domain.ErrProviderName) {
		t.Fatal("不应重复创建")
	}
	invalid := templateInput()
	invalid.IMAP.TLSMode = "none"
	if _, err := service.Create(t.Context(), invalid); err != domain.ErrProviderTemplate {
		t.Fatal("不能关闭 TLS")
	}
	input = templateInput()
	input.Name = "Gmail"
	if _, err := service.Create(t.Context(), input); err != domain.ErrProviderName {
		t.Fatal("不可冒充内置名称")
	}
}
func TestCustomProvidersConcurrentAndLimit(t *testing.T) {
	service := NewCustomProviders(config.NewCustomProviders(t.TempDir()))
	var wg sync.WaitGroup
	var mu sync.Mutex
	success := 0
	for range 8 {
		wg.Go(func() {
			_, err := service.Create(context.Background(), templateInput())
			if err == nil {
				mu.Lock()
				success++
				mu.Unlock()
			}
		})
	}
	wg.Wait()
	if success != 1 {
		t.Fatal("并发同名只能创建一次")
	}
	for i := 1; i < domain.MaxCustomProviders; i++ {
		input := templateInput()
		input.Name = fmt.Sprintf("邮箱 %d", i)
		if _, err := service.Create(t.Context(), input); err != nil {
			t.Fatal(err)
		}
	}
	input := templateInput()
	input.Name = "超限"
	if _, err := service.Create(t.Context(), input); err != domain.ErrProviderLimit {
		t.Fatal("必须有数量边界")
	}
}
func TestCustomProvidersFailurePreservesFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "custom-providers.json")
	original := []byte("invalid-private")
	if err := os.WriteFile(path, original, 0o600); err != nil {
		t.Fatal(err)
	}
	service := NewCustomProviders(config.NewCustomProviders(dir))
	if _, err := service.Create(t.Context(), templateInput()); err != domain.ErrProviderStorage {
		t.Fatal("坏文件不能被静默覆盖")
	}
	data, _ := os.ReadFile(path)
	if string(data) != string(original) {
		t.Fatal("破坏了原配置")
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if _, err := service.Create(ctx, templateInput()); !errors.Is(err, context.Canceled) {
		t.Fatal("取消不能创建")
	}
}
