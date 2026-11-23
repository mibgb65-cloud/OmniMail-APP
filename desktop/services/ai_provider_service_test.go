package services

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"omnimail/internal/ai"
	"omnimail/internal/config"
	"omnimail/internal/profilemgr"
)

type aiTestBootstrap struct{ state profilemgr.BootstrapState }

func (b *aiTestBootstrap) ReadBootstrapState() profilemgr.BootstrapState {
	return b.state
}

func (b *aiTestBootstrap) WriteBootstrapState(state profilemgr.BootstrapState) error {
	b.state = state
	return nil
}

func TestAiProviderServiceUsesEndpointScopedVaultAndUnsavedTestConfig(t *testing.T) {
	boot := &aiTestBootstrap{state: profilemgr.BootstrapState{DataDir: t.TempDir(), ActiveProfileID: "personal"}}
	manager := profilemgr.NewManager(boot, nil)
	t.Cleanup(manager.Close)
	if err := manager.InitStartup(); err != nil {
		t.Fatal(err)
	}
	svc := NewAiService(manager, nil)
	ctx := context.Background()
	const savedKey = "local-test-saved-key"
	const temporaryKey = "local-test-ephemeral-key"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/saved/models":
			if r.Header.Get("Authorization") != "Bearer "+savedKey {
				t.Error("未使用当前端点的已保存密钥")
			}
			_, _ = fmt.Fprint(w, `{"data":[{"id":"saved-model"}]}`)
		case "/other/models":
			if r.Header.Get("Authorization") != "" {
				t.Error("不能把已保存网关的密钥带到新的地址")
			}
			_, _ = fmt.Fprint(w, `{"data":[{"id":"other-model"}]}`)
		case "/other/chat/completions":
			if r.Header.Get("Authorization") != "Bearer "+temporaryKey {
				t.Error("测试连接未使用临时密钥")
			}
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"OK\"}}]}\n\ndata: [DONE]\n\n")
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	oldURL, newURL := srv.URL+"/saved", srv.URL+"/other"
	appSettings, err := svc.SaveAiProviderConfig(ai.SaveConfigRequest{
		Provider: "custom", BaseURL: oldURL, Model: "saved-model", APIKey: savedKey,
	})
	if err != nil || appSettings.AiApiKeyMasked == "" || appSettings.AiApiKeyMasked == savedKey {
		t.Fatal("保存结果应只包含脱敏密钥", err)
	}
	for _, url := range []string{oldURL, newURL} {
		if list, err := svc.FetchAiModels(ctx, ai.ModelsRequest{Provider: "custom", BaseURL: url}); err != nil || len(list) != 1 {
			t.Fatalf("拉取模型失败：%v", err)
		}
	}
	testResult, err := svc.TestAiConnection(ctx, ai.SaveConfigRequest{
		Provider: "custom", BaseURL: newURL, Model: "another-model", APIKey: temporaryKey,
	})
	if err != nil || !testResult.OK {
		t.Fatalf("未保存的配置应可以独立测试：%s %v", testResult.Message, err)
	}
	updated, err := manager.GetAppSettings()
	if err != nil || updated.AiBaseURL != oldURL || updated.AiModel != "saved-model" {
		t.Fatal("测试不能修改活动配置", err)
	}
	if mask, err := svc.GetAiApiKeyMask("custom", newURL); err != nil || mask != "" {
		t.Fatal("测试密钥不可保存", err)
	}
	if _, err := svc.ClearAiApiKey("custom", oldURL); err != nil {
		t.Fatal(err)
	}
	if mask, err := svc.GetAiApiKeyMask("custom", oldURL); err != nil || mask != "" {
		t.Fatal("清除后不应再读取到密钥", err)
	}
}

func TestAiProviderSaveIgnoresSuppliedPresetBaseURL(t *testing.T) {
	manager := profilemgr.NewManager(&aiTestBootstrap{state: profilemgr.BootstrapState{DataDir: t.TempDir()}}, nil)
	t.Cleanup(manager.Close)
	if err := manager.InitStartup(); err != nil {
		t.Fatal(err)
	}
	svc := NewAiService(manager, nil)
	res, err := svc.SaveAiProviderConfig(ai.SaveConfigRequest{
		Provider: "deepseek", BaseURL: "https://api.openai.com/v1", Model: "deepseek-chat", APIKey: "deepseek-test-fixture",
	})
	if err != nil || res.AiBaseURL != config.AiPresetBaseURL("deepseek") {
		t.Fatalf("保存官方配置时必须固化官方地址：%v", err)
	}
}
