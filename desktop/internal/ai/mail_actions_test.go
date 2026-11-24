package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/profilemgr"
	"omnimail/internal/storage"
)

func setupMailActions(t *testing.T) (*profilemgr.Session, config.AppSettings) {
	t.Helper()
	dir := t.TempDir()
	db, err := storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { storage.CheckpointAndClose(db) })
	seedAiChatMails(t, db)
	settings := config.DefaultAppSettings()
	settings.AiEnabled, settings.AiAutoSummarizeOnOpen = true, true
	settings.AiProvider = "custom"
	return &profilemgr.Session{ProfileDir: dir, DB: db, Ctx: t.Context()}, settings
}

func saveActionSettings(t *testing.T, sess *profilemgr.Session, settings config.AppSettings) {
	t.Helper()
	if err := config.SaveProfileSettings(sess.ProfileDir, settings); err != nil {
		t.Fatal(err)
	}
}

func TestIndependentMailActionsAndAutoCache(t *testing.T) {
	sess, settings := setupMailActions(t)
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		var req struct{ Messages []ChatMessage }
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Messages) != 2 {
			t.Error("模型请求缺少独立的系统提示和邮件上下文")
			http.Error(w, "", http.StatusBadRequest)
			return
		}
		prompt := req.Messages[0].Content
		var reply string
		switch {
		case strings.Contains(prompt, "draftReply") && !strings.Contains(prompt, "summaryTitle"):
			if !strings.Contains(prompt, "简体中文") || !strings.Contains(prompt, "友好") {
				t.Error("拟稿提示词应按所选语言和语气生成")
			}
			reply = `{"draftReply":"收到，谢谢！","sourceLanguage":"en","summary":"不得覆盖摘要"}`
		case strings.Contains(prompt, "summaryTitle") && !strings.Contains(prompt, "draftReply"):
			reply = `{"summary":"会议改至周五。","sourceLanguage":"en","draftReply":["不得覆盖草稿"]}`
		default:
			t.Error("提示词仍捆绑摘要与拟稿")
		}
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"content\":%q}}]}\n\ndata: [DONE]\n\n", reply)
	}))
	defer server.Close()
	settings.AiBaseURL = server.URL
	saveActionSettings(t, sess, settings)
	gw := NewGateway(nil)
	ctx := t.Context()
	draft := MailDraftOptions{TargetLanguage: "zh-CN", Tone: "friendly"}
	auto := MailSummaryOptions{AutoTriggered: true}

	if _, err := gw.GenerateReplyDraft(ctx, sess, "mail-a", false, draft); apperr.CodeOf(err) != apperr.CodeAiConsentRequired {
		t.Fatalf("拟稿不能因自动摘要开启而跳过确认：%v", err)
	}
	if _, err := gw.SummarizeMail(ctx, sess, "mail-a", false, true, MailSummaryOptions{}); apperr.CodeOf(err) != apperr.CodeAiConsentRequired {
		t.Fatalf("手动刷新仍需确认：%v", err)
	}
	if _, err := gw.AskMailStream(sess, AskMailRequest{MailID: "mail-a", Question: "几点开会？"}); apperr.CodeOf(err) != apperr.CodeAiConsentRequired {
		t.Fatalf("追问仍需确认：%v", err)
	}
	if calls.Load() != 0 {
		t.Fatal("确认前不可调用模型")
	}
	if err := appendChatTurnsToDB(ctx, sess.DB, "mail-a", "test", "r", "问题", "答案", false); err != nil {
		t.Fatal(err)
	}
	ins, err := gw.GenerateReplyDraft(ctx, sess, "mail-a", true, draft)
	if err != nil || ins.DraftReply == "" || ins.Summary != "" || ins.DraftLanguage != "zh-CN" || ins.SourceLanguage != "en" {
		t.Fatalf("独立草稿保存不正确：%v", err)
	}
	var flagged int
	if err := sess.DB.QueryRow(`SELECT ai_summarized FROM messages WHERE id='mail-a'`).Scan(&flagged); err != nil || flagged != 0 {
		t.Fatalf("仅拟稿不应标记已摘要：%d, %v", flagged, err)
	}
	ins, err = gw.SummarizeMail(ctx, sess, "mail-a", false, false, auto)
	if err != nil || ins.Summary != "会议改至周五。" || ins.DraftReply != "收到，谢谢！" || ins.DraftTone != "friendly" {
		t.Fatalf("未确认的自动摘要应成功并保留草稿：%v", err)
	}
	ins, err = gw.SummarizeMail(ctx, sess, "mail-a", false, false, auto)
	if err != nil || !ins.Cached || calls.Load() != 2 {
		t.Fatalf("二次打开不应再请求模型：calls=%d, %v", calls.Load(), err)
	}
	ins, err = gw.GenerateReplyDraft(ctx, sess, "mail-a", true, draft)
	if err != nil || ins.Summary != "会议改至周五。" || ins.SummaryLanguage != "zh-CN" {
		t.Fatalf("重跑拟稿不能覆盖摘要：%v", err)
	}
	_, turns, err := gw.GetCachedInsight(ctx, sess.DB, "mail-a")
	if err != nil || len(turns) != 2 {
		t.Fatalf("两种请求均应保留对话：%v", err)
	}
}

func TestMailSummaryCancellation(t *testing.T) {
	sess, settings := setupMailActions(t)
	started, disconnected := make(chan struct{}), make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		w.(http.Flusher).Flush()
		close(started)
		select {
		case <-r.Context().Done():
			close(disconnected)
		case <-time.After(5 * time.Second):
		}
	}))
	defer server.Close()
	settings.AiBaseURL = server.URL
	saveActionSettings(t, sess, settings)
	gw := NewGateway(nil)
	req := MailSummaryOptions{AutoTriggered: true, RequestID: "aireq-00000000-0000-4000-8000-000000000001"}
	done := make(chan error, 1)
	go func() {
		_, err := gw.SummarizeMail(t.Context(), sess, "mail-a", false, false, req)
		done <- err
	}()
	select {
	case <-started:
	case err := <-done:
		t.Fatalf("发起摘要前失败：%v", err)
	case <-time.After(3 * time.Second):
		t.Fatal("模型未收到摘要请求")
	}
	gw.CancelRequest(req.RequestID)
	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("取消应中断摘要：%v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("取消后摘要仍未退出")
	}
	select {
	case <-disconnected:
	case <-time.After(3 * time.Second):
		t.Fatal("取消后模型连接未关闭")
	}
	ins, _, err := gw.GetCachedInsight(t.Context(), sess.DB, "mail-a")
	if err != nil || ins != nil {
		t.Fatalf("取消的摘要不能写入缓存：%v", err)
	}
}
