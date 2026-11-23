package config

import "testing"

func TestResolveAiEndpoint(t *testing.T) {
	for _, tc := range []struct{ provider, input, want string }{
		{"deepseek", "https://api.openai.com/v1", "https://api.deepseek.com/v1"},
		{"claude", "https://wrong.example.com/v1", "https://api.anthropic.com/v1"},
		{"gemini", "://坏地址", "https://generativelanguage.googleapis.com/v1beta"},
		{"openai", "", "https://api.openai.com/v1"},
		{"ollama", "", OllamaDefaultBaseURL},
		{"ollama", "http://localhost:11435/v1/", "http://localhost:11435/v1"},
		{"custom", " https://GATEWAY.example.com/v1/ ", "https://gateway.example.com/v1"},
	} {
		provider, endpoint, err := ResolveAiEndpoint(tc.provider, tc.input)
		if err != nil || provider != tc.provider || endpoint != tc.want {
			t.Fatalf("%s 端点不符：%q, %v", tc.provider, endpoint, err)
		}
	}
	for _, illegal := range []string{
		"", "ftp://gateway.example.com", "/v1", "https://user:pass@gateway.example.com/v1",
		"https://gateway.example.com/v1?foo=bar", "https://gateway.example.com/v1#fragment",
		"http://localhost:99999/v1",
	} {
		if _, _, err := ResolveAiEndpoint("custom", illegal); err == nil {
			t.Fatalf("应拒绝无效端点：%q", illegal)
		}
	}
}

func TestAiVaultKeysAreProviderAndEndpointScoped(t *testing.T) {
	const base = "https://gateway.example.com/v1"
	if AiVaultKey("custom", base) == AiVaultKey("custom", base+"2") ||
		AiVaultKey("custom", base) == AiVaultKey("ollama", base) ||
		AiVaultKey("deepseek", base) == AiVaultKey("openai", base) {
		t.Fatal("不同提供方或网关不能共用密钥")
	}
	if AiVaultKey("openai", base) != LegacyAiVaultKey("openai") {
		t.Fatal("官方已有密钥应保留兼容")
	}
	if AiEndpointAllowsKey("http://gateway.example.com/v1") || !AiEndpointAllowsKey("http://[::1]:11434/v1") {
		t.Fatal("远程 HTTP 不应携带密钥；本机回环允许")
	}
}
