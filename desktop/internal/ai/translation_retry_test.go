package ai

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"omnimail/internal/apperr"
)

func TestFreeTranslationRetriesOnlyTransientResponses(t *testing.T) {
	for _, tt := range []struct {
		name, retryAfter, body, hint string
		status, calls                int
	}{
		{"HTTP 限流", "", "", "限制请求", 429, 2},
		{"HTTP 临时故障", "", "", "暂时不可用", 503, 2},
		{"HTTP 明确拒绝", "", "", "拒绝请求", 403, 1},
		{"HTTP 等待过长", "60", "", "限制请求", 429, 1},
		{"兼容网关业务码", "", `{"code":-509,"message":"https://private.example/stack"}`, "限制请求", 200, 2},
		{"兼容网关其他非零状态", "", `{"code":-500,"message":"https://private.example/stack"}`, "未能处理", 200, 2},
		{"OpenAI 限流错误对象", "", `{"error":{"code":"rate_limit_exceeded","message":"https://private.example/stack"}}`, "限制请求", 200, 2},
		{"永久业务错误", "", `{"code":-400,"message":"https://private.example/stack"}`, "配置无效", 200, 1},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			var calls atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				calls.Add(1)
				if tt.retryAfter != "" {
					w.Header().Set("Retry-After", tt.retryAfter)
				}
				w.WriteHeader(tt.status)
				_, _ = w.Write([]byte(tt.body))
			}))
			defer server.Close()
			engine := freeTranslationBatch(server.URL, 2*time.Second)
			_, _, err := engine(t.Context(), "en", "zh-CN", []string{"Test only."})
			if int(calls.Load()) != tt.calls || apperr.CodeOf(err) != apperr.CodeTranslationFailed {
				t.Fatalf("重试次数或错误类型不符：%d，%v", calls.Load(), err)
			}
			if message := err.Error(); !strings.Contains(message, tt.hint) ||
				!strings.Contains(message, "设置 → 邮件翻译") || !strings.Contains(message, "AI 助手模型") ||
				strings.Contains(message, "private.example") || strings.Contains(message, "stack") {
				t.Fatal("应显示中文恢复建议而非上游正文")
			}
		})
	}
}

func TestTranslationRetryAfterAndCancellation(t *testing.T) {
	now := time.Date(2026, 11, 24, 0, 0, 0, 0, time.UTC)
	for header, want := range map[string]time.Duration{
		"": translationRetryDelay, "0": translationRetryDelay,
		"2": 2 * time.Second, "4": noTranslationRetry,
		now.Add(2 * time.Second).Format(http.TimeFormat): 2 * time.Second,
		now.Add(8 * time.Second).Format(http.TimeFormat): noTranslationRetry,
	} {
		if got := translationRetryAfter(header, now); got != want {
			t.Errorf("Retry-After %q: %s != %s", header, got, want)
		}
	}
	var calls atomic.Int32
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
		w.Header().Set("Retry-After", "3")
		w.WriteHeader(http.StatusTooManyRequests)
		cancel()
	}))
	defer server.Close()
	_, _, err := freeTranslationBatch(server.URL, time.Second)(ctx, "en", "zh-CN", []string{"Test only."})
	if !errors.Is(err, context.Canceled) || calls.Load() != 1 {
		t.Fatalf("取消后不得重发：%v，%d 次", err, calls.Load())
	}
}

func TestPartialFreeTranslationKeepsSafeUpstreamFailure(t *testing.T) {
	sess, settings := setupMailActions(t)
	settings.AiEnabled = false
	var lines []string
	for i := 'A'; i <= 'M'; i++ {
		lines = append(lines, "Test line "+string(i))
	}
	if _, err := sess.DB.Exec(`UPDATE messages SET body_text=? WHERE id='mail-a'`, strings.Join(lines, "\n")); err != nil {
		t.Fatal(err)
	}
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if calls.Add(1) == 1 {
			writeFreeTestResponse(w, `{"0":"甲","1":"乙","2":"丙","3":"丁","4":"戊","5":"己","6":"庚","7":"辛","8":"壬","9":"癸","10":"子","11":"丑"}`)
			return
		}
		w.Header().Set("Retry-After", "30")
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer server.Close()
	settings.TranslationEndpoint = server.URL
	saveActionSettings(t, sess, settings)
	req := TranslateMailRequest{MailID: "mail-a", RequestID: "00000000-0000-4000-8000-000000000007",
		Source: "en", Target: "zh-CN", ConsentConfirmed: true}
	translated, err := NewGateway(nil).TranslateMail(t.Context(), sess, req)
	if err != nil || translated.CompletedBatches != 1 || translated.TotalBatches != 2 ||
		translated.Segments[lines[0]] != "甲" || !strings.Contains(translated.FailureMessage, "限制请求") {
		t.Fatalf("部分译文应带上安全的失败提示：%v", err)
	}
}
