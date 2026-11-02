package aiapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"omnimail/desktop/internal/domain"
)

func TestAIContractAndOutputValidation(t *testing.T) {
	source := domain.TranslatedText{Subject: "Title", Body: "Alice: Friday"}
	for _, test := range []struct {
		name, content string
		valid         bool
	}{
		{"ok", `{"summary":"摘要","points":[],"tasks":[{"text":"处理","evidence":"Alice: Friday","owner":"Alice","due":"Friday"}],"facts":[],"reply":""}`, true},
		{"invented", `{"summary":"摘要","points":[],"tasks":[],"facts":[{"text":"错误","evidence":"not in mail"}],"reply":""}`, false},
		{"unknown", `{"summary":"摘要","points":[],"tasks":[],"facts":[],"reply":"","tool":"send"}`, false},
		{"missing", `{"summary":"摘要"}`, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/v1/chat/completions" || r.Header.Get("Authorization") != "Bearer synthetic" {
					t.Error("请求路径或密钥协议错误")
				}
				var payload struct {
					Messages []map[string]string `json:"messages"`
				}
				if json.NewDecoder(r.Body).Decode(&payload) != nil || len(payload.Messages) != 2 ||
					payload.Messages[0]["role"] != "system" || !strings.Contains(payload.Messages[1]["content"], "untrusted_mail") {
					t.Error("系统规则与不可信邮件未分离")
				}
				json.NewEncoder(w).Encode(map[string]interface{}{"choices": []interface{}{map[string]interface{}{
					"finish_reason": "stop", "message": map[string]string{"content": test.content},
				}}})
			}))
			defer server.Close()
			client := &Client{http: server.Client()}
			_, err := client.Generate(t.Context(), domain.AIConfig{Endpoint: server.URL + "/v1", Model: "test", Language: "zh"}, []byte("synthetic"), source, domain.AIRequest{MailID: "test", Action: "analysis"})
			if (err == nil) != test.valid {
				t.Fatalf("响应校验不符 %v", err)
			}
		})
	}
}

func TestAIRateLimitAndBodyDeadline(t *testing.T) {
	for _, slow := range []bool{false, true} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !slow {
				w.Header().Set("Retry-After", "99999")
				w.WriteHeader(429)
				return
			}
			w.Write([]byte(`{"choices":`))
			w.(http.Flusher).Flush()
			<-r.Context().Done()
		}))
		ctx, cancel := context.WithTimeout(t.Context(), 100*time.Millisecond)
		_, err := (&Client{http: server.Client()}).Generate(ctx, domain.AIConfig{Endpoint: server.URL, Model: "test", Language: "zh"}, nil,
			domain.TranslatedText{Body: "synthetic"}, domain.AIRequest{MailID: "test", Action: "analysis"})
		cancel()
		server.Close()
		var rate *domain.AIRateLimit
		if slow && !errors.Is(err, context.DeadlineExceeded) || !slow && (!errors.As(err, &rate) || rate.Seconds != 300) {
			t.Fatalf("取消/有界限流分类不正确 %v", err)
		}
	}
}
