package aiapi

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestDeepSeekPayloadOptionsAreScopedToOfficialEndpoint(t *testing.T) {
	for _, test := range []struct {
		endpoint string
		deepseek bool
	}{
		{"https://api.deepseek.com", true},
		{"https://api.deepseek.com/v1/", true},
		{"https://API.DEEPSEEK.COM:443/v1", true},
		{"https://api.deepseek.com.evil.invalid/v1", false},
		{"https://example.invalid/v1", false},
		{"https://example.invalid/deepseek", false},
		{"http://127.0.0.1:11434/v1", false},
		{"http://api.deepseek.com/v1", false},
		{"https://api.deepseek.com:8443/v1", false},
		{"https://user@api.deepseek.com/v1", false},
		{"https://api.deepseek.com/v1?key=synthetic", false},
		{"https://api.deepseek.com/anthropic", false},
	} {
		t.Run(test.endpoint, func(t *testing.T) {
			data, err := payload(domain.AIConfig{Endpoint: test.endpoint, Model: "deepseek-flash", Language: "zh"},
				domain.TranslatedText{Body: "synthetic"}, domain.AIRequest{MailID: "mail_test", Action: "analysis"})
			if err != nil {
				t.Fatal(err)
			}
			var got struct {
				Messages []struct {
					Content string `json:"content"`
				} `json:"messages"`
				Model    string `json:"model"`
				Stream   bool   `json:"stream"`
				Thinking *struct {
					Type string `json:"type"`
				} `json:"thinking"`
				ResponseFormat *struct {
					Type string `json:"type"`
				} `json:"response_format"`
			}
			if json.Unmarshal(data, &got) != nil || got.Model != "deepseek-flash" || got.Stream {
				t.Fatal("基础调用参数错误")
			}
			if test.deepseek {
				if got.Thinking == nil || got.Thinking.Type != "disabled" || got.ResponseFormat == nil || got.ResponseFormat.Type != "json_object" {
					t.Fatal("DeepSeek 邮件助手必须关闭思考并启用 JSON 输出")
				}
				if len(got.Messages) != 2 || !strings.Contains(got.Messages[0].Content, "json") {
					t.Fatal("启用 JSON 模式还必须在消息中明确要求 json 输出")
				}
			} else if got.Thinking != nil || got.ResponseFormat != nil {
				t.Fatal("不得将 DeepSeek 特有参数注入其他服务")
			}
		})
	}
}

func TestDeepSeekBlankOrReasoningOnlyResponseIsNotSuccess(t *testing.T) {
	for _, content := range []string{
		`{"choices":[{"finish_reason":"stop","message":{"content":"   ","reasoning_content":"not a final answer"}}]}`,
		`{"choices":[{"finish_reason":"stop","message":{"reasoning_content":"not a final answer"}}]}`,
		`{"choices":[{"finish_reason":"length","message":{"content":"{}"}}]}`,
	} {
		if _, err := decode([]byte(content), domain.TranslatedText{Body: "synthetic"}, "analysis"); !errors.Is(err, domain.ErrAIResponse) {
			t.Fatal("空白/推理/截断不能当作完整结果", err)
		}
	}
}
