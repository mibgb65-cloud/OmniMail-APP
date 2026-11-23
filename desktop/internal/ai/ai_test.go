package ai

import (
	"context"
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
	"omnimail/internal/profilemgr"
	"omnimail/internal/security"
	"omnimail/internal/storage"
)

func TestPrivacyGuardFiveGatesAndGatewayCache(t *testing.T) {
	dir := t.TempDir()
	db, err := storage.OpenProfileDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer storage.CheckpointAndClose(db)

	vault, err := security.OpenVault("ai-test", dir)
	if err != nil {
		t.Fatal(err)
	}
	nowMs := time.Now().UnixMilli()
	_, _ = db.Exec(`INSERT INTO accounts(id,name,short_tag,email,provider,provider_label,auth_mode,imap_host,imap_port,imap_security,smtp_host,smtp_port,smtp_security,created_at)
		VALUES ('acc-1','Work','工作','me@corp.com','imap','IMAP','password','imap.corp.com',993,'SSL/TLS','smtp.corp.com',465,'SSL/TLS',?)`, nowMs)
	_, _ = db.Exec(`INSERT INTO threads(id,account_id,subject,snippet,last_msg_at) VALUES ('t1','acc-1','Sub','Snip',?)`, nowMs)

	// 正常邮件（含银行卡与手机号用于测试 Gate 5 脱敏）
	_, _ = db.Exec(`INSERT INTO messages(id,account_id,thread_id,folder,sender_name,sender_email,subject,body_text,sent_at,received_at)
		VALUES ('m-ok','acc-1','t1','inbox','Alice','alice@secret.com','项目进度','请于周五前反馈。联系人手机 13912345678，卡号 6222021234567890123。',?,?)`, nowMs, nowMs)
	// 敏感验证码邮件（Gate 3）
	_, _ = db.Exec(`INSERT INTO messages(id,account_id,thread_id,folder,sender_name,sender_email,subject,body_text,sent_at,received_at)
		VALUES ('m-otp','acc-1','t1','inbox','Sec','sec@bank.com','您的登录一次性密码','验证码为 883920',?,?)`, nowMs, nowMs)

	settings := config.DefaultAppSettings()
	settings.AiEnabled = false
	if _, err := PrepareMailContext(db, settings, "m-ok", true); apperr.CodeOf(err) != apperr.CodeAiDisabled {
		t.Fatalf("Gate 1 failed: expected ERR_AI_DISABLED, got %v", err)
	}

	settings.AiEnabled = true
	settings.AiRequireConfirmEachTime = true
	if _, err := PrepareMailContext(db, settings, "m-otp", true); apperr.CodeOf(err) != apperr.CodeAiSensitiveBlocked {
		t.Fatalf("Gate 3 failed: expected ERR_AI_SENSITIVE_BLOCKED on OTP mail, got %v", err)
	}
	if _, err := PrepareMailContext(db, settings, "m-ok", false); apperr.CodeOf(err) != apperr.CodeAiConsentRequired {
		t.Fatalf("Gate 2 failed: expected ERR_AI_CONSENT_REQUIRED, got %v", err)
	}

	settings.AiProvider = "openai"
	settings.AiIncludeSenderAndAttachments = false
	ctxText, err := PrepareMailContext(db, settings, "m-ok", true)
	if err != nil {
		t.Fatalf("PrepareMailContext valid failed: %v", err)
	}
	if strings.Contains(ctxText, "alice@secret.com") || strings.Contains(ctxText, "Alice") {
		t.Fatalf("Gate 4 violation: sender leaked in strict mode: %s", ctxText)
	}
	if strings.Contains(ctxText, "13912345678") || strings.Contains(ctxText, "6222021234567890123") {
		t.Fatalf("Gate 5 violation: phone or bank card not redacted: %s", ctxText)
	}

	// 验证 SSE 流式网关与 ai_insights 缓存命中（第二次零 HTTP 调用）
	var httpCalls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		atomic.AddInt32(&httpCalls, 1)
		w.Header().Set("Content-Type", "text/event-stream")
		payload := `{"summaryTitle":"周五反馈进度","summary":"请在本周五前提交项目反馈。","deadlines":[{"label":"提交反馈","timeText":"本周五","urgent":true}],"draftTag":"建议回复","draftReply":"收到，周五前反馈。"}`
		_, _ = fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"content\":%q}}]}\n\ndata: [DONE]\n\n", payload)
	}))
	defer srv.Close()

	_ = vault.Set(VaultAiKey("openai"), "sk-test-1234567890abcdef")
	settings.AiBaseURL = srv.URL
	settings.AiRequireConfirmEachTime = false
	_ = config.SaveProfileSettings(dir, settings)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	sess := &profilemgr.Session{ProfileDir: dir, DB: db, Vault: vault, Ctx: ctx, Cancel: cancel}
	gw := NewGateway(events.NewBus())

	ins1, err := gw.AnalyzeMail(sess, "m-ok", true, false)
	if err != nil || ins1.SummaryTitle != "周五反馈进度" || atomic.LoadInt32(&httpCalls) != 1 {
		t.Fatalf("AnalyzeMail 1 failed: %+v, calls=%d, err=%v", ins1, httpCalls, err)
	}
	ins2, err := gw.AnalyzeMail(sess, "m-ok", true, false)
	if err != nil || !ins2.Cached || atomic.LoadInt32(&httpCalls) != 1 {
		t.Fatalf("expected second AnalyzeMail to hit SQLite cache with 0 extra HTTP calls, got cached=%v calls=%d", ins2.Cached, httpCalls)
	}
}
