package ai

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/events"
)

func writeFreeTestResponse(w http.ResponseWriter, content string) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = fmt.Fprintf(w, `{"choices":[{"message":{"content":%q},"finish_reason":"stop"}]}`, content)
}

func TestFreeMailTranslationWithoutAIAndWithBatchEvents(t *testing.T) {
	sess, settings := setupMailActions(t)
	settings.AiEnabled = false
	settings.TranslationProvider = config.TranslationProviderFree
	const first = "Contact sample@example.test or 13912345678"
	markup := `<table><tr><td>` + first + `</td><td><a href="https://example.test/link">Read more</a></td></tr></table>` +
		`<pre>local-code-marker</pre><img src="https://example.test/image"><p hidden>hidden-marker</p>`
	for i := range 12 {
		markup += fmt.Sprintf("<p>Build step %d</p>", i)
	}
	if _, err := sess.DB.Exec(`UPDATE messages SET subject='Release status', body_html_sanitized=? WHERE id='mail-a'`, markup); err != nil {
		t.Fatal(err)
	}
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		var input struct {
			Model    string
			Messages []ChatMessage
		}
		if r.Method != http.MethodPost || r.URL.Path != "/translate" || r.Header.Get("Authorization") != "" ||
			r.Header.Get("Cookie") != "" || r.Header.Get("Content-Type") != "application/json" ||
			r.UserAgent() != "Index-Translate-Client/1.0" ||
			json.NewDecoder(r.Body).Decode(&input) != nil || input.Model != "Index-Translate-35B-A3B" || len(input.Messages) != 1 {
			t.Error("免费路径未使用正确接口或意外发送密钥")
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		prompt := input.Messages[0].Content
		_, body, _ := strings.Cut(prompt, "\n\n")
		var segments map[string]string
		if json.Unmarshal([]byte(body), &segments) != nil || !strings.Contains(prompt, "简体中文") || !strings.Contains(prompt, "英语") {
			t.Error("缺少语言映射或可独立定位的片段")
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		for _, forbidden := range []string{"sample@example.test", "13912345678", "local-code-marker", "hidden-marker", "https://example.test/", "<table>"} {
			if strings.Contains(body, forbidden) {
				t.Errorf("翻译载荷包含未授权内容：%s", forbidden)
			}
		}
		for key, text := range segments {
			segments[key] = "译：" + text
		}
		raw, _ := json.Marshal(segments)
		writeFreeTestResponse(w, string(raw))
	}))
	defer server.Close()
	settings.TranslationEndpoint = server.URL + "/translate"
	saveActionSettings(t, sess, settings)
	bus := events.NewBus()
	var batches []events.MailTranslationBatchPayload
	bus.Subscribe(func(name string, payload any) {
		if name == events.MailTranslationBatch {
			batches = append(batches, payload.(events.MailTranslationBatchPayload))
		}
	})
	ctx := t.Context()
	gateway := NewGateway(bus)
	req := TranslateMailRequest{
		MailID: "mail-a", RequestID: "00000000-0000-4000-8000-000000000003",
		Provider: config.TranslationProviderFree, Source: "en", Target: "zh-CN", IncludeSubject: true, ConsentConfirmed: true,
	}
	result, err := gateway.TranslateMail(ctx, sess, req)
	if err != nil || result.TotalBatches != 2 || result.CompletedBatches != 2 || len(batches) != 2 ||
		batches[0].CompletedBatches != 1 || batches[1].CompletedBatches != 2 || result.Subject != "译：Release status" ||
		result.Segments[first] != "译：Contact [REDACTED_EMAIL] or [REDACTED_PHONE]" || result.Segments["Read more"] != "译：Read more" {
		t.Fatalf("免密保真翻译或逐批映射不正确：%v", err)
	}
	if report, err := gateway.TestTranslationConnection(ctx, sess); err != nil || !report.OK || calls.Load() != 3 {
		t.Fatalf("使用固定样例的免密连通性测试失败：%v", err)
	}

	if _, err := sess.DB.Exec(`UPDATE messages SET body_html_sanitized='<p>Your verification <b>code</b> is 405827</p>' WHERE id='mail-a'`); err != nil {
		t.Fatal(err)
	}
	if _, err := gateway.TranslateMail(ctx, sess, req); apperr.CodeOf(err) != apperr.CodeAiSensitiveBlocked || calls.Load() != 3 {
		t.Fatalf("HTML 敏感邮件不得产生额外网络调用：%v", err)
	}
	settings.TranslationProvider = config.TranslationProviderAI
	saveActionSettings(t, sess, settings)
	if _, err := gateway.TranslateMail(ctx, sess, req); apperr.CodeOf(err) != apperr.CodeInvalidInput {
		t.Fatalf("切换引擎后不应向新提供商发送旧请求：%v", err)
	}
	req.Provider = config.TranslationProviderAI
	if _, err := gateway.TranslateMail(ctx, sess, req); apperr.CodeOf(err) != apperr.CodeAiDisabled {
		t.Fatalf("BYOK 路径仍需启用 AI 总开关：%v", err)
	}
}

func TestFreeTranslationRetriesTimeoutOnce(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			select {
			case <-r.Context().Done():
			case <-time.After(time.Second):
			}
			return
		}
		writeFreeTestResponse(w, `{"0":"您好"}`)
	}))
	defer server.Close()
	engine := freeTranslationBatch(server.URL, 150*time.Millisecond)
	_, items, err := engine(t.Context(), "en", "zh-CN", []string{"Hello"})
	if err != nil || len(items) != 1 || items[0] != "您好" || calls.Load() != 2 {
		t.Fatalf("超时后应重试一次：%v", err)
	}
}

func TestFreeTranslationDefaultResolvesToPublishedEndpoint(t *testing.T) {
	got, err := freeTranslationEndpoint(config.DefaultTranslationEndpoint)
	if err != nil || got != indexTranslateEndpoint {
		t.Fatal("默认预设应指向可用的公开接口")
	}
	if _, err := readIndexedTranslations(`{"0":"正确","2":"不得错位"}`, 2); err == nil {
		t.Fatal("编号缺失不得产生错位译文")
	}
}

func TestFreeTranslationDoesNotResendTextThroughRedirect(t *testing.T) {
	var redirected atomic.Bool
	destination := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		redirected.Store(true)
	}))
	defer destination.Close()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, destination.URL, http.StatusTemporaryRedirect)
	}))
	defer server.Close()
	engine := freeTranslationBatch(server.URL, time.Second)
	if _, _, err := engine(t.Context(), "en", "zh-CN", []string{"Test message"}); err == nil || redirected.Load() {
		t.Fatal("翻译服务不能跟随重定向把正文转发到其他地址")
	}
}
