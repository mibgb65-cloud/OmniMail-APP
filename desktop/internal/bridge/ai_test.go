package bridge

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"omnimail/desktop/internal/aiapi"
	"omnimail/desktop/internal/domain"
	"omnimail/desktop/internal/repository"
	"omnimail/desktop/internal/service"
)

type aiReader struct{}

func (aiReader) ReadMail(context.Context, string) (domain.MailDetail, error) {
	return domain.MailDetail{MailSummary: domain.MailSummary{ID: "mail_test", AccountID: "account_test", Subject: "synthetic subject", Cached: true}, Body: "synthetic body", BodyVersion: 1}, nil
}

type aiNoSecrets struct{}

func (aiNoSecrets) Set(context.Context, string, []byte) error { return domain.ErrCredentialUnavailable }
func (aiNoSecrets) Get(context.Context, string) ([]byte, error) {
	return nil, domain.ErrCredentialMissing
}
func (aiNoSecrets) Delete(context.Context, string) error { return nil }

func TestAIBridgeLocalHTTPAnalysisAndCache(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Header.Get("Authorization") != "" || r.URL.Path != "/v1/chat/completions" {
			t.Error("请求协议错误")
		}
		content := `{"summary":"合成摘要","points":[],"tasks":[],"facts":[],"reply":""}`
		json.NewEncoder(w).Encode(map[string]interface{}{"choices": []interface{}{map[string]interface{}{"finish_reason": "stop", "message": map[string]string{"content": content}}}})
	}))
	defer server.Close()
	dir := t.TempDir()
	translation := service.NewTranslation(aiReader{}, repository.NewTranslationStore(dir), nil)
	defer translation.Close()
	ai := service.NewAI(aiReader{}, repository.NewAIStore(dir), aiNoSecrets{}, aiapi.New())
	defer ai.Close()
	b := NewAIBridge(ai, translation)
	if _, err := b.SaveConfig(t.Context(), domain.AIConfigInput{Endpoint: server.URL + "/v1", Model: "synthetic-model", Language: "zh", Consent: true}); err != nil {
		t.Fatal(err)
	}
	got, err := b.Run(t.Context(), domain.AIRequest{MailID: "mail_test", Action: "analysis"})
	if err != nil || got.Summary != "合成摘要" || got.AccountID != "account_test" || calls != 1 {
		t.Fatal("跨层分析失败", err)
	}
	cached, err := b.Cached(t.Context(), "mail_test")
	if err != nil || cached == nil || !cached.Cached || calls != 1 {
		t.Fatal("恢复缓存错误", err)
	}
	if err := b.ClearCache(t.Context()); err != nil {
		t.Fatal(err)
	}
	if cached, err := b.Cached(t.Context(), "mail_test"); err != nil || cached != nil || calls != 1 {
		t.Fatal("清理后错误联网", err)
	}
}
