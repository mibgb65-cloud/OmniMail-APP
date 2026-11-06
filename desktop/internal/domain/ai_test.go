package domain

import "testing"

func TestAIEndpointValidation(t *testing.T) {
	for _, value := range []string{"https://example.invalid/v1/", "http://127.0.0.1:11434/v1", "http://[::1]:8080/v1", "http://localhost:1234/v1"} {
		if _, err := NormalizeAIEndpoint(value); err != nil {
			t.Fatalf("有效端点被拒绝 %q", value)
		}
	}
	for _, value := range []string{
		"http://example.invalid/v1", "https://user:secret@example.invalid/v1", "https://example.invalid/v1?key=secret",
		"https://example.invalid/v1#", "https://example.invalid/v1#secret", "file:///tmp",
		"https://example.invalid:0/v1", "https://example.invalid:65536/v1", "https://example.invalid/v1/chat/completions",
		"https://example.invalid/%2e%2e/x", "https://example.invalid/../x", " https://example.invalid",
	} {
		if _, err := NormalizeAIEndpoint(value); err == nil {
			t.Fatalf("非法端点被接受 %q", value)
		}
	}
}

func TestAIConfigRejectsInvalidFields(t *testing.T) {
	valid := AIConfigInput{Endpoint: "https://example.invalid/v1", Model: "test/model", Language: "zh"}
	if valid.Validate() != nil {
		t.Fatal("有效配置不应被拒绝")
	}
	for _, mutate := range []func(*AIConfigInput){
		func(c *AIConfigInput) { c.Model = "bad\nmodel" },
		func(c *AIConfigInput) { c.Language = "unsupported" },
		func(c *AIConfigInput) { c.APIKey = "secret\nheader" },
		func(c *AIConfigInput) { c.APIKey, c.RemoveKey = "test", true },
	} {
		c := valid
		mutate(&c)
		if c.Validate() == nil {
			t.Fatal("非法配置未拒绝")
		}
	}
}
