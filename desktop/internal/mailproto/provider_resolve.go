package mailproto

import (
	"net"
	"strings"
)

func PresetByID(id string) ProviderPreset {
	all := ListProviderPresets()
	for _, p := range all {
		if p.ID == id {
			return p
		}
	}
	return all[len(all)-1]
}

// ResolveProviderByEmail 根据邮箱域名识别内置预设，未知企业域名支持 DNS SRV 与常见主机探测。
func ResolveProviderByEmail(email string) ProviderPreset {
	cleaned := strings.ToLower(strings.TrimSpace(email))
	at := strings.LastIndexByte(cleaned, '@')
	if at < 0 || at == len(cleaned)-1 {
		return PresetByID("imap")
	}
	domain := cleaned[at+1:]

	switch domain {
	case "gmail.com", "googlemail.com":
		return PresetByID("gmail")
	case "outlook.com", "hotmail.com", "live.com", "msn.com", "office365.com":
		return PresetByID("outlook")
	case "qq.com", "foxmail.com", "vip.qq.com":
		return PresetByID("qq")
	case "163.com":
		return PresetByID("netease")
	case "126.com":
		p := PresetByID("netease")
		p.DefaultImapHost = "imap.126.com"
		p.DefaultSmtpHost = "smtp.126.com"
		return p
	case "yeah.net":
		p := PresetByID("netease")
		p.DefaultImapHost = "imap.yeah.net"
		p.DefaultSmtpHost = "smtp.yeah.net"
		return p
	case "icloud.com", "me.com", "mac.com":
		return PresetByID("icloud")
	case "yahoo.com", "yahoo.co.jp", "ymail.com":
		return PresetByID("yahoo")
	case "yandex.com", "yandex.ru", "ya.ru":
		return PresetByID("yandex")
	case "linux.do", "linuxdo.org":
		return PresetByID("linuxdo")
	case "naver.com":
		return PresetByID("nevermail")
	}

	custom := PresetByID("imap")
	if _, addrs, err := net.LookupSRV("imaps", "tcp", domain); err == nil && len(addrs) > 0 {
		custom.DefaultImapHost = strings.TrimSuffix(addrs[0].Target, ".")
		if addrs[0].Port > 0 {
			custom.DefaultImapPort = int(addrs[0].Port)
		}
	} else if hostResolves("imap." + domain) {
		custom.DefaultImapHost = "imap." + domain
	} else if hostResolves("mail." + domain) {
		custom.DefaultImapHost = "mail." + domain
	} else {
		custom.DefaultImapHost = "imap." + domain
	}

	if _, addrs, err := net.LookupSRV("submissions", "tcp", domain); err == nil && len(addrs) > 0 {
		custom.DefaultSmtpHost = strings.TrimSuffix(addrs[0].Target, ".")
		if addrs[0].Port > 0 {
			custom.DefaultSmtpPort = int(addrs[0].Port)
		}
	} else if hostResolves("smtp." + domain) {
		custom.DefaultSmtpHost = "smtp." + domain
	} else if hostResolves("mail." + domain) {
		custom.DefaultSmtpHost = "mail." + domain
	} else {
		custom.DefaultSmtpHost = "smtp." + domain
	}
	return custom
}

func hostResolves(host string) bool {
	ips, err := net.LookupHost(host)
	return err == nil && len(ips) > 0
}

// NormalizeAccountSecret 自动去除首尾空白；对 Gmail 16 位应用专用密码自动去除中间空格。
func NormalizeAccountSecret(provider, email, secret string) string {
	trimmed := strings.TrimSpace(secret)
	lowerEmail := strings.ToLower(strings.TrimSpace(email))
	if provider == "gmail" || strings.HasSuffix(lowerEmail, "@gmail.com") || strings.HasSuffix(lowerEmail, "@googlemail.com") {
		noSpaces := strings.Join(strings.Fields(trimmed), "")
		if len(noSpaces) == 16 {
			return noSpaces
		}
	}
	return trimmed
}

func ShouldSendIMAPID(provider, imapHost string) bool {
	if provider == "netease" {
		return true
	}
	h := strings.ToLower(strings.TrimSpace(imapHost))
	return strings.HasSuffix(h, ".163.com") || strings.HasSuffix(h, ".126.com") || strings.HasSuffix(h, ".yeah.net")
}
