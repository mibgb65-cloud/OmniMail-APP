package ai

import (
	"database/sql"
	"fmt"
	"regexp"
	"strings"

	"omnimail/internal/apperr"
	"omnimail/internal/config"
	"omnimail/internal/security"
)

var (
	rePrivateKeyPEM = regexp.MustCompile(`-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----`)
	reOTPKeywords   = regexp.MustCompile(`(?i)(验证码|动态口令|一次性密码|重置密码|password\s+reset|verification\s+code|one-time\s+passcode|\botp\b)`)
	reBankCard      = regexp.MustCompile(`\b[3-6][0-9]{15,18}\b`)
	reCNIdentity    = regexp.MustCompile(`\b[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b`)
	reCNMobile      = regexp.MustCompile(`\b1[3-9]\d{9}\b`)
)

// PrepareMailContext 执行 5 步隐私守卫校验、最小上下文裁剪与敏感字段正则脱敏。
func PrepareMailContext(db *sql.DB, settings config.AppSettings, mailID string, consentConfirmed bool) (string, error) {
	// Gate 1: 总开关校验
	if !settings.AiEnabled {
		return "", apperr.New(apperr.CodeAiDisabled, "AI 助手总开关未启用，请前往「设置 → AI 配置」开启")
	}

	var folder, senderName, subj, bodyText, snippet, secJSON string
	var aiBlocked int
	err := db.QueryRow(`
		SELECT folder, sender_name, subject, body_text, snippet, security_json, ai_blocked
		FROM messages WHERE id = ?
	`, strings.TrimSpace(mailID)).Scan(&folder, &senderName, &subj, &bodyText, &snippet, &secJSON, &aiBlocked)
	if err != nil {
		return "", apperr.New(apperr.CodeNotFound, "未找到目标邮件")
	}

	// Gate 3: 敏感邮件硬拦截（优先于确认框，避免向用户误弹钓鱼/验证码外发确认）
	if IsSensitiveMail(folder, subj, bodyText, secJSON, aiBlocked != 0) {
		return "", apperr.New(apperr.CodeAiSensitiveBlocked, "此邮件包含验证码、私钥或高危钓鱼特征，已按本地隐私规则禁止 AI 读取")
	}

	// Gate 4: 最小上下文裁剪
	rawBody := strings.TrimSpace(bodyText)
	if rawBody == "" {
		rawBody = snippet
	}
	trimmedBody := truncateRunes(rawBody, 8000)

	var ctxBuilder strings.Builder
	if settings.AiIncludeSenderAndAttachments {
		ctxBuilder.WriteString("发件人显示名: " + senderName + "\n")
		ctxBuilder.WriteString("邮件主题: " + subj + "\n")
		ctxBuilder.WriteString("正文内容:\n" + trimmedBody + "\n")
		if attPrev := loadTextAttachmentPreviews(db, mailID); attPrev != "" {
			ctxBuilder.WriteString("\n文本附件摘要:\n" + truncateRunes(attPrev, 4000))
		}
	} else {
		// 严格模式：绝不附带发件人/收件人邮箱、邮件头或任何附件名与内容
		ctxBuilder.WriteString(trimmedBody)
	}
	prepared := ctxBuilder.String()

	// Gate 2: 单次发送确认闸门
	if settings.AiRequireConfirmEachTime && !consentConfirmed {
		scopeNote := "不含发件人地址与任何附件"
		if settings.AiIncludeSenderAndAttachments {
			scopeNote = "含主题与纯文本附件摘要，不含二进制附件"
		}
		return "", apperr.New(
			apperr.CodeAiConsentRequired,
			fmt.Sprintf("即将发送约 %d 字符内容（%s）至 %s", len([]rune(prepared)), scopeNote, settings.AiProvider),
		)
	}

	// Gate 5: 本地正则脱敏（云端模型强制脱敏银行卡/身份证/手机号/私钥）
	if !strings.EqualFold(settings.AiProvider, "ollama") {
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
	if !strings.EqualFold(settings.AiProvider, "ollama") {
		trimmed = RedactOutgoingPrompt(trimmed)
	}
	return trimmed, nil
}

func IsSensitiveMail(folder, subject, body, securityJSON string, aiBlocked bool) bool {
	if aiBlocked || folder == "spam" || folder == "trash" {
		return true
	}
	if strings.Contains(strings.ToLower(securityJSON), `"level":"danger"`) {
		return true
	}
	combined := subject + "\n" + truncateRunes(body, 2500)
	return rePrivateKeyPEM.MatchString(combined) || reOTPKeywords.MatchString(combined)
}

func RedactOutgoingPrompt(s string) string {
	out := security.RedactSensitive(s)
	out = rePrivateKeyPEM.ReplaceAllString(out, "[REDACTED_PRIVATE_KEY]")
	out = reCNIdentity.ReplaceAllString(out, "[REDACTED_ID]")
	out = reBankCard.ReplaceAllString(out, "[REDACTED_CARD]")
	out = reCNMobile.ReplaceAllString(out, "[REDACTED_PHONE]")
	return out
}

func loadTextAttachmentPreviews(db *sql.DB, mailID string) string {
	rows, err := db.Query(`SELECT filename, preview_text FROM attachments WHERE message_id=? AND is_inline=0 AND preview_text != '' LIMIT 5`, mailID)
	if err != nil {
		return ""
	}
	defer rows.Close()
	var parts []string
	for rows.Next() {
		var fn, prev string
		if rows.Scan(&fn, &prev) == nil && prev != "" {
			parts = append(parts, fmt.Sprintf("[%s]: %s", fn, prev))
		}
	}
	return strings.Join(parts, "\n")
}

func truncateRunes(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max])
}
