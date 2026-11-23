package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/profilemgr"
	"omnimail/internal/storage"
)

func TestMailTranslationUsesVisibleTextAndExplicitConsent(t *testing.T) {
	dir := t.TempDir()
	db, err := storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)
	seedAiChatMails(t, db)
	const markup = `<table><tr><td>Build completed</td><td><code>keep-code</code><a href="https://example.org/private-link">Read more</a></td></tr></table>` +
		`<p style="display: none">tracking-marker</p><img src="https://example.org/private-image" alt="image-metadata">` +
		`<p>person@example.org</p><p>https://example.org/private-footer</p>`
	if _, err := db.Exec(`UPDATE messages SET subject='Build note', body_html_sanitized=? WHERE id='mail-a'`, markup); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO attachments(id,message_id,filename,preview_text)
		VALUES ('file','mail-a','local-only.txt','local-preview-marker')`); err != nil {
		t.Fatal(err)
	}
	sent := make(chan []string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var input struct{ Messages []ChatMessage }
		var segments []string
		if json.NewDecoder(r.Body).Decode(&input) != nil || len(input.Messages) != 2 ||
			json.Unmarshal([]byte(input.Messages[1].Content), &segments) != nil {
			http.Error(w, "invalid test payload", http.StatusBadRequest)
			return
		}
		sent <- segments
		w.Header().Set("Content-Type", "text/event-stream")
		modelReply := `{"source":"en","segments":["构建说明","构建完成","查看更多"]}`
		_, _ = fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"content\":%q}}]}\n\ndata: [DONE]\n\n", modelReply)
	}))
	defer server.Close()
	settings := config.DefaultAppSettings()
	settings.AiEnabled, settings.AiProvider, settings.AiBaseURL = true, "custom", server.URL
	if err := config.SaveProfileSettings(dir, settings); err != nil {
		t.Fatal(err)
	}
	gateway := NewGateway(nil)
	session := &profilemgr.Session{ProfileDir: dir, DB: db, Ctx: context.Background()}
	request := TranslateMailRequest{MailID: "mail-a", Source: "auto", Target: "zh-CN", IncludeSubject: true}
	mismatch := request
	mismatch.ProfileID = "other-profile"
	if _, err := gateway.TranslateMail(session, mismatch); apperr.CodeOf(err) != apperr.CodeInvalidInput {
		t.Fatalf("工作空间不匹配时不得翻译: %v", err)
	}
	if _, err := gateway.TranslateMail(session, request); apperr.CodeOf(err) != apperr.CodeAiConsentRequired {
		t.Fatalf("未确认时不得翻译: %v", err)
	}
	request.ConsentConfirmed = true
	result, err := gateway.TranslateMail(session, request)
	if err != nil || result.Source != "en" || result.Subject != "构建说明" ||
		result.Segments["Read more"] != "查看更多" || result.Segments["Build completed"] != "构建完成" {
		t.Fatalf("邮件翻译映射错误: %v", err)
	}
	if got := <-sent; !reflect.DeepEqual(got, []string{"Build note", "Build completed", "Read more"}) {
		t.Fatalf("翻译请求未遵守文字边界: %q", got)
	}
}

func TestTranslationBatchValidation(t *testing.T) {
	if _, _, err := parseTranslationBatch(`{"source":"en","segments":["仅一个片段"]}`, 2); err == nil {
		t.Fatal("片段缺失时不应以错位的译文覆盖原文")
	}
	if _, err := batchTranslationSegments([]string{strings.Repeat("字", 4801)}); err == nil {
		t.Fatal("不应无提示截断超长片段")
	}
	got, err := mailTranslationSegments("", "first line\nsecond line\n\nthird line")
	if err != nil || !reflect.DeepEqual(got, []string{"first line", "second line", "third line"}) {
		t.Fatalf("纯文本片段未与阅读器的分行一致: %v", err)
	}
}

func TestMailAnalysisUsesDifferentSummaryAndDraftLanguages(t *testing.T) {
	prompt := mailAnalysisPrompt("en", mailUILanguage("zh-CN"), "friendly")
	for _, expected := range []string{"用简体中文撰写", "draftReply 必须使用英语", "自然、友好"} {
		if !strings.Contains(prompt, expected) {
			t.Errorf("摘要提示缺少 %q", expected)
		}
	}
}
