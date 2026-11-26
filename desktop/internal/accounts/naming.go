package accounts

import "strings"

// ConciseProviderName 返回去除“邮箱 / Mail / 邮件”冗余后缀的精简账户默认名称；通用 IMAP 优先提取域名。
func ConciseProviderName(providerID, email string) string {
	switch strings.ToLower(strings.TrimSpace(providerID)) {
	case "gmail":
		return "Gmail"
	case "outlook":
		return "Outlook"
	case "qq":
		return "QQ"
	case "netease":
		return "网易"
	case "linuxdo":
		return "Linux.do"
	case "icloud":
		return "iCloud"
	case "yahoo":
		return "Yahoo"
	case "nevermail":
		return "Naver"
	case "yandex":
		return "Yandex"
	case "tencent_exmail":
		return "腾讯企业邮"
	case "aliyun_exmail":
		return "阿里企业邮"
	case "netease_exmail":
		return "网易企业邮"
	case "feishu":
		return "飞书"
	case "mail263":
		return "263 企业邮"
	case "zoho_exmail":
		return "Zoho"
	default:
		clean := strings.ToLower(strings.TrimSpace(email))
		if at := strings.LastIndexByte(clean, '@'); at >= 0 && at < len(clean)-1 {
			return clean[at+1:]
		}
		return "IMAP"
	}
}

func strOrDefault(v, def string) string {
	if s := strings.TrimSpace(v); s != "" {
		return s
	}
	return def
}

func intOrDefault(v, def int) int {
	if v > 0 {
		return v
	}
	return def
}

func truncateRunes(s string, maxRunes int) string {
	trimmed := strings.TrimSpace(s)
	if maxRunes <= 0 || trimmed == "" {
		return trimmed
	}
	runes := []rune(trimmed)
	if len(runes) <= maxRunes {
		return trimmed
	}
	return string(runes[:maxRunes])
}
