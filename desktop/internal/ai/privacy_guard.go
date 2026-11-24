package ai

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net"
	"net/url"
	"regexp"
	"strings"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/security"
)

var (
	rePrivateKeyPEM = regexp.MustCompile(`-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----`)
	reOTPKeywords   = regexp.MustCompile(`(?i)(验证码|动态口令|一次性密码|重置密码|密码重置|reset\s+(?:your\s+)?password|password\s+reset|(?:verification|security|sign[- ]in|login)\s+code|one[- ]time\s+(?:passcode|password|code)|\botp\b)`)
	reBankCard      = regexp.MustCompile(`\b[3-6][0-9]{15,18}\b`)
	reCNIdentity    = regexp.MustCompile(`\b[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b`)
	reCNMobile      = regexp.MustCompile(`\b1[3-9]\d{9}\b`)
	reMailAddress   = regexp.MustCompile(`(?i)[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+`)
)

// PrepareMailContext 执行 5 步隐私守卫校验、最小上下文裁剪与敏感字段正则脱敏。
func PrepareMailContext(ctx context.Context, db *sql.DB, settings config.AppSettings, mailID string, consentConfirmed, autoTriggered bool) (string, error) {
	mail, err := loadGuardedMail(ctx, db, settings, mailID, autoTriggered)
	if err != nil {
		return "", err
	}
	return mail.prepare(settings, consentConfirmed, autoTriggered)
}

type guardedMail struct{ subject, body, snippet string }

func loadGuardedMail(ctx context.Context, db *sql.DB, settings config.AppSettings, mailID string, autoTriggered bool) (guardedMail, error) {
	// Gate 1: 总开关校验
	if !settings.AiEnabled {
		return guardedMail{}, apperr.New(apperr.CodeAiDisabled, "AI 助手总开关未启用，请前往「设置 → AI 助手」开启")
	}
	if autoTriggered && !settings.AiAutoSummarizeOnOpen {
		return guardedMail{}, apperr.New(apperr.CodeAiDisabled, "尚未启用阅读时自动摘要")
	}

	var mail guardedMail
	var folder, secJSON string
	var aiBlocked int
	err := db.QueryRowContext(ctx, `
		SELECT folder, subject, body_text, snippet, security_json, ai_blocked
		FROM messages WHERE id = ?
	`, mailID).Scan(&folder, &mail.subject, &mail.body, &mail.snippet, &secJSON, &aiBlocked)
	if err != nil {
		if ctx.Err() != nil {
			return guardedMail{}, ctx.Err()
		}
		return guardedMail{}, apperr.New(apperr.CodeNotFound, "无法读取目标邮件")
	}

	// Gate 3: 敏感邮件硬拦截（优先于确认框，避免向用户误弹钓鱼/验证码外发确认）
	if IsSensitiveMail(folder, mail.subject, mail.body, secJSON, aiBlocked != 0) || hasSensitiveMailText(mail.snippet) {
		return guardedMail{}, apperr.New(apperr.CodeAiSensitiveBlocked, "敏感邮件已跳过，未向模型发送内容")
	}
	return mail, nil
}

func (mail guardedMail) prepare(settings config.AppSettings, consentConfirmed, autoTriggered bool) (string, error) {
	// Gate 4: 最小上下文裁剪
	rawBody := strings.TrimSpace(mail.body)
	if rawBody == "" {
		rawBody = strings.TrimSpace(mail.snippet)
	}
	trimmedBody := truncateRunes(rawBody, 8000)

	prepared := trimmedBody
	scopeNote := "仅邮件正文，不含附件"
	// 兼容旧配置键，但分享范围只包括主题；不读取附件、附件名、预览或邮件头。
	if settings.AiIncludeSenderAndAttachments {
		prepared = "邮件主题: " + truncateRunes(mail.subject, 1000) + "\n正文内容:\n" + trimmedBody
		scopeNote = "邮件主题与正文，不含附件"
	}

	// Gate 2: 单次发送确认闸门
	if settings.AiRequireConfirmEachTime && !consentConfirmed && !autoTriggered {
		return "", apperr.New(
			apperr.CodeAiConsentRequired,
			fmt.Sprintf("即将发送约 %d 字符内容（%s）至 %s", len([]rune(prepared)), scopeNote, settings.AiProvider),
		)
	}

	// Gate 5: 本地正则脱敏（云端模型强制脱敏银行卡/身份证/手机号/私钥）
	if requiresPromptRedaction(settings.AiProvider, settings.AiBaseURL) {
		prepared = RedactOutgoingPrompt(prepared)
	}
	return prepared, nil
}

func PrepareComposeContext(settings config.AppSettings, text string, consentConfirmed bool) (string, error) {
	if !settings.AiEnabled {
		return "", apperr.New(apperr.CodeAiDisabled, "AI 助手总开关未启用，请前往「设置 → AI 配置」开启")
	}
	if rePrivateKeyPEM.MatchString(text) {
		return "", apperr.New(apperr.CodeAiSensitiveBlocked, "草稿中包含私钥块，已按隐私规则拦截外发")
	}
	if settings.AiRequireConfirmEachTime && !consentConfirmed {
		return "", apperr.New(apperr.CodeAiConsentRequired, "请确认允许将当前草稿片段发送给配置的模型润色")
	}
	trimmed := truncateRunes(text, 6000)
	if requiresPromptRedaction(settings.AiProvider, settings.AiBaseURL) {
		trimmed = RedactOutgoingPrompt(trimmed)
	}
	return trimmed, nil
}

func IsSensitiveMail(folder, subject, body, securityJSON string, aiBlocked bool) bool {
	if aiBlocked || folder == "spam" || folder == "trash" {
		return true
	}
	var warning security.SecurityWarningResult
	if json.Unmarshal([]byte(securityJSON), &warning) == nil && strings.EqualFold(warning.Level, "danger") {
		return true
	}
	return hasSensitiveMailText(subject) || hasSensitiveMailText(body)
}

func hasSensitiveMailText(text string) bool {
	return rePrivateKeyPEM.MatchString(text) || reOTPKeywords.MatchString(text)
}

func requiresPromptRedaction(provider, baseURL string) bool {
	provider, baseURL, err := config.ResolveAiEndpoint(provider, baseURL)
	if err != nil || provider != "ollama" {
		return true
	}
	endpoint, err := url.Parse(baseURL)
	if err != nil {
		return true
	}
	// 只有本机 Ollama 可跳过脱敏；选择同名服务不能给远程端点豁免。
	host := endpoint.Hostname()
	return host != "localhost" && !net.ParseIP(host).IsLoopback()
}

func RedactOutgoingPrompt(s string) string {
	out := security.RedactSensitive(s)
	out = rePrivateKeyPEM.ReplaceAllString(out, "[REDACTED_PRIVATE_KEY]")
	out = reCNIdentity.ReplaceAllString(out, "[REDACTED_ID]")
	out = reBankCard.ReplaceAllString(out, "[REDACTED_CARD]")
	out = reCNMobile.ReplaceAllString(out, "[REDACTED_PHONE]")
	out = reMailAddress.ReplaceAllString(out, "[REDACTED_EMAIL]")
	return out
}

func truncateRunes(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max])
}
