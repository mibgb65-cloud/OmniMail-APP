package translationapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"omnimail/desktop/internal/domain"
	"os"
	"strings"
	"testing"
)

// 默认不访问公网；仅人工显式开启时发送固定的非敏感合成短文。
func TestIndexTranslationPublicSmoke(t *testing.T) {
	if os.Getenv("OMNIMAIL_TRANSLATION_SMOKE") != "1" {
		t.Skip("公网测试默认关闭")
	}
	client := New()
	defer client.http.CloseIdleConnections()
	result, err := client.Translate(t.Context(), domain.TranslatedText{
		Subject: "Meeting reminder", Body: "Hello, world! The meeting starts at 9 AM.",
	}, "zh")
	if err != nil {
		t.Fatal(err)
	}
	if result.Subject == "" || result.Body == "" {
		t.Fatal("未返回标题与正文")
	}
	t.Log("合成标题和正文的 JSON 译文已验证，未发送任何真实邮件")
}

func TestTranslateContract(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "" || r.Header.Get("Cookie") != "" {
			t.Error("不应发送鉴权或 Cookie")
		}
		var value struct {
			Model    string `json:"model"`
			Messages []struct {
				Content string `json:"content"`
			} `json:"messages"`
			Template map[string]bool `json:"chat_template_kwargs"`
		}
		if json.NewDecoder(r.Body).Decode(&value) != nil || value.Model != domain.TranslationModel || value.Template["enable_thinking"] {
			t.Error("请求协议错误")
		}
		if !strings.Contains(value.Messages[0].Content, "自动识别") || !strings.Contains(value.Messages[0].Content, "中文") {
			t.Error("目标或源语言提示缺失")
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"model": domain.TranslationModel, "choices": []interface{}{map[string]interface{}{"finish_reason": "stop", "message": map[string]string{"content": `{"subject":"会议","body":"你好！"}`}}}})
	}))
	defer server.Close()
	client := &Client{http: server.Client(), endpoint: server.URL}
	result, err := client.Translate(t.Context(), domain.TranslatedText{Subject: "Meeting", Body: "Hello!"}, "zh")
	if err != nil || result.Subject != "会议" || result.Body != "你好！" {
		t.Fatalf("翻译结果 %v %v", result, err)
	}
}
func TestTranslateRejectsUnsafeResponses(t *testing.T) {
	for _, test := range []struct {
		name     string
		status   int
		response string
		want     error
	}{
		{"rate", 429, `private-body`, domain.ErrTranslationRate},
		{"server", 503, `private-body`, domain.ErrTranslationUnavailable},
		{"json", 200, `<html>private</html>`, domain.ErrTranslationResponse},
		{"truncated", 200, `{"model":"Index-Translate-35B-A3B","choices":[{"finish_reason":"length","message":{"content":"private"}}]}`, domain.ErrTranslationTruncated},
		{"invalid", 200, `{"model":"Index-Translate-35B-A3B","choices":[{"finish_reason":"stop","message":{"content":"<think>unfinished"}}]}`, domain.ErrTranslationResponse},
		{"empty", 200, `{"model":"Index-Translate-35B-A3B","choices":[{"finish_reason":"stop","message":{"content":"{\"subject\":\"\",\"body\":\"\"}"}}]}`, domain.ErrTranslationResponse},
	} {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(test.status)
				w.Write([]byte(test.response))
			}))
			defer server.Close()
			_, err := (&Client{http: server.Client(), endpoint: server.URL}).Translate(t.Context(), domain.TranslatedText{Subject: "s", Body: "b"}, "zh")
			if !errors.Is(err, test.want) {
				t.Fatalf("错误结果 %v", err)
			}
		})
	}
}
func TestTranslateCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { <-r.Context().Done() }))
	defer server.Close()
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if _, err := (&Client{http: server.Client(), endpoint: server.URL}).Translate(ctx, domain.TranslatedText{Body: "x"}, "zh"); err != context.Canceled {
		t.Fatal("取消未传递")
	}
}
