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
	settings.TranslationProvider = config.TranslationProviderAI
	settings.AiEnabled, settings.AiProvider, settings.AiBaseURL = true, "custom", server.URL
	if err := config.SaveProfileSettings(dir, settings); err != nil {
		t.Fatal(err)
	}
	gateway := NewGateway(nil)
	session := &profilemgr.Session{ProfileDir: dir, DB: db, Ctx: context.Background()}
	request := TranslateMailRequest{MailID: "mail-a", RequestID: "00000000-0000-4000-8000-000000000001", Source: "auto", Target: "zh-CN", IncludeSubject: true}
	mismatch := request
	mismatch.ProfileID = "other-profile"
	if _, err := gateway.TranslateMail(t.Context(), session, mismatch); apperr.CodeOf(err) != apperr.CodeInvalidInput {
		t.Fatalf("工作空间不匹配时不得翻译: %v", err)
	}
	if _, err := gateway.TranslateMail(t.Context(), session, request); apperr.CodeOf(err) != apperr.CodeAiConsentRequired {
		t.Fatalf("未确认时不得翻译: %v", err)
	}
	request.ConsentConfirmed = true
	result, err := gateway.TranslateMail(t.Context(), session, request)
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

func TestMailActionsUseDifferentSummaryAndDraftLanguages(t *testing.T) {
	summary := mailSummaryPrompt("en", mailUILanguage("zh-CN"))
	if !strings.Contains(summary, "用简体中文输出") || strings.Contains(summary, "draftReply") {
		t.Fatal("摘要应使用界面语言，不请求回复草稿")
	}
	draft := mailDraftPrompt(MailDraftOptions{SourceLanguage: "en", TargetLanguage: "original", Tone: "friendly"})
	if !strings.Contains(draft, "原邮件正文的主要语言（英语）与友好语气") || strings.Contains(draft, "summaryTitle") {
		t.Fatal("拟稿应使用原文语言及指定语气，不请求摘要")
	}
}
