package ai

import (
	"strings"
	"testing"
	"unicode/utf8"

	"omnimail/internal/apperr"
)

func TestAutomaticMailSummaryPrivacyGates(t *testing.T) {
	sess, settings := setupMailActions(t)
	ctx, db := t.Context(), sess.DB
	settings.AiAutoSummarizeOnOpen = false
	saveActionSettings(t, sess, settings)
	gw := NewGateway(nil)
	auto := MailSummaryOptions{AutoTriggered: true}
	if _, err := gw.SummarizeMail(ctx, sess, "mail-a", true, false, auto); apperr.CodeOf(err) != apperr.CodeAiDisabled {
		t.Fatalf("逐次同意不能替代自动摘要设置：%v", err)
	}
	settings.AiEnabled, settings.AiAutoSummarizeOnOpen = false, true
	saveActionSettings(t, sess, settings)
	if _, err := gw.SummarizeMail(ctx, sess, "mail-a", false, false, auto); apperr.CodeOf(err) != apperr.CodeAiDisabled {
		t.Fatalf("自动摘要不能绕过 AI 总开关：%v", err)
	}
	settings.AiEnabled = true
	saveActionSettings(t, sess, settings)
	for _, test := range []struct {
		name, folder, subject, body, snippet, warning string
		blocked                                       bool
	}{
		{name: "垃圾邮件", folder: "spam"},
		{name: "回收站", folder: "trash"},
		{name: "高危钓鱼", folder: "inbox", warning: `{ "level": "danger" }`},
		{name: "验证码", folder: "inbox", snippet: "Your verification code is 123456"},
		{name: "密码重置", folder: "inbox", subject: "Reset your password"},
		{name: "后段私钥", folder: "inbox", body: strings.Repeat("字", 3000) + "-----BEGIN PRIVATE KEY-----"},
		{name: "显式禁读", folder: "inbox", blocked: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			if _, err := db.Exec(`UPDATE messages SET folder=?, subject=?, body_text=?, snippet=?, security_json=?, ai_blocked=? WHERE id='mail-a'`,
				test.folder, test.subject, test.body, test.snippet, test.warning, test.blocked); err != nil {
				t.Fatal(err)
			}
			if _, err := gw.SummarizeMail(ctx, sess, "mail-a", false, false, auto); apperr.CodeOf(err) != apperr.CodeAiSensitiveBlocked {
				t.Fatalf("敏感邮件应在访问模型前硬拦截：%v", err)
			}
		})
	}

	if _, err := db.Exec(`UPDATE messages SET subject='不应发送的主题', body_text=? WHERE id='mail-b'`,
		"13912345678 dummy@example.test "+strings.Repeat("字", 8000)+"裁剪标记"); err != nil {
		t.Fatal(err)
	}
	prompt, err := PrepareMailContext(ctx, db, settings, "mail-b", false, true)
	if err != nil || !strings.Contains(prompt, "[REDACTED_PHONE]") ||
		!strings.Contains(prompt, "[REDACTED_EMAIL]") || strings.Contains(prompt, "不应发送的主题") ||
		strings.Contains(prompt, "裁剪标记") ||
		utf8.RuneCountInString(prompt) > 8010 {
		t.Fatalf("自动摘要仍需裁剪、最小化范围和云端脱敏：%v", err)
	}
	settings.AiProvider, settings.AiBaseURL = "ollama", "https://remote.example/v1"
	prompt, err = PrepareMailContext(ctx, db, settings, "mail-b", false, true)
	if err != nil || !strings.Contains(prompt, "[REDACTED_PHONE]") {
		t.Fatalf("远程 Ollama 不能绕过云端脱敏：%v", err)
	}
}
