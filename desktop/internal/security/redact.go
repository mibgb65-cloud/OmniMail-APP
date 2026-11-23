package security

import (
	"regexp"
	"strings"
)

var (
	reAuthHeader  = regexp.MustCompile(`(?i)(Authorization\s*:\s*)(?:Bearer|Basic)\s+[^\s"'\r\n]+`)
	reImapLogin   = regexp.MustCompile(`(?i)\b(LOGIN\s+(?:"[^"]*"|\S+)\s+)(?:"[^"]*"|\S+)`)
	reSaslPlain   = regexp.MustCompile(`(?i)\b(AUTH\s+(?:PLAIN|LOGIN|XOAUTH2)\s+)[A-Za-z0-9+/=._-]+`)
	reTokenKV     = regexp.MustCompile(`(?i)((?:access_token|refresh_token|id_token|api_key|apikey|password|secret|client_secret)["'=:\s]+)[^\s"',}&\r\n]+`)
	reSkApiKey    = regexp.MustCompile(`\b(sk-[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,})\b`)
	reCookieValue = regexp.MustCompile(`(?i)(Cookie\s*:\s*)[^\r\n]+`)
)

// RedactSensitive 强制抹除日志与诊断文本中的令牌、授权码、API Key 与密码字段。
func RedactSensitive(raw string) string {
	if raw == "" {
		return ""
	}
	s := reAuthHeader.ReplaceAllString(raw, "${1}[REDACTED]")
	s = reImapLogin.ReplaceAllString(s, "${1}[REDACTED]")
	s = reSaslPlain.ReplaceAllString(s, "${1}[REDACTED]")
	s = reTokenKV.ReplaceAllString(s, "${1}[REDACTED]")
	s = reSkApiKey.ReplaceAllString(s, "[REDACTED_KEY]")
	s = reCookieValue.ReplaceAllString(s, "${1}[REDACTED]")
	return s
}

// MaskSecret 将 API Key 等凭据格式化为脱敏展示态（如 sk-****...9f2a），绝不返回明文。
func MaskSecret(secret string) string {
	trimmed := strings.TrimSpace(secret)
	if trimmed == "" {
		return ""
	}
	runes := []rune(trimmed)
	n := len(runes)
	if n <= 6 {
		return "****"
	}
	prefixLen := 3
	if strings.HasPrefix(trimmed, "sk-proj-") && n > 12 {
		prefixLen = 8
	} else if strings.HasPrefix(trimmed, "sk-") && n > 8 {
		prefixLen = 3
	}
	suffixLen := 4
	if prefixLen+suffixLen >= n {
		return string(runes[:2]) + "****"
	}
	return string(runes[:prefixLen]) + "****..." + string(runes[n-suffixLen:])
}

// MaskEmail 将邮箱地址脱敏为 m***@domain.com 格式（用于诊断报告与测试输出）。
func MaskEmail(email string) string {
	trimmed := strings.TrimSpace(email)
	at := strings.IndexByte(trimmed, '@')
	if at <= 0 {
		return "***"
	}
	local := []rune(trimmed[:at])
	domain := trimmed[at:]
	if len(local) <= 1 {
		return "****" + domain
	}
	return string(local[0]) + "***" + domain
}
