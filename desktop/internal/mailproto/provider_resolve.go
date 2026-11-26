package mailproto

import (
	"context"
	"net"
	"strings"
	"time"
)

var lookupMXFn = func(domain string) ([]*net.MX, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 2200*time.Millisecond)
	defer cancel()
	return net.DefaultResolver.LookupMX(ctx, domain)
}

func PresetByID(id string) ProviderPreset {
	all := ListProviderPresets()
	for _, p := range all {
		if p.ID == id {
			return p
		}
	}
	return all[len(all)-1]
}

// ResolveProviderByEmail 根据邮箱域名识别内置预设，未知自定义企业域名优先通过 DNS MX 自动识别服务商，再回退 SRV/常见主机探测。
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
	case "exmail.qq.com":
		return PresetByID("tencent_exmail")
	case "qiye.aliyun.com":
		return PresetByID("aliyun_exmail")
	case "163.com":
		return PresetByID("netease")
	case "126.com":
		p := PresetByID("netease")
		p.DefaultImapHost, p.DefaultSmtpHost = "imap.126.com", "smtp.126.com"
		return p
	case "yeah.net":
		p := PresetByID("netease")
		p.DefaultImapHost, p.DefaultSmtpHost = "imap.yeah.net", "smtp.yeah.net"
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
	case "feishu.cn":
		return PresetByID("feishu")
	case "larksuite.com":
		p := PresetByID("feishu")
		p.DefaultImapHost, p.DefaultSmtpHost = "imap.larksuite.com", "smtp.larksuite.com"
		return p
	case "263.net", "263xmail.com":
		return PresetByID("mail263")
	}

	if mxRecords, err := lookupMXFn(domain); err == nil && len(mxRecords) > 0 {
		if matched, ok := ResolveProviderByMXRecords(mxRecords); ok {
			return matched
		}
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
	ctx, cancel := context.WithTimeout(context.Background(), 1200*time.Millisecond)
	defer cancel()
	ips, err := net.DefaultResolver.LookupHost(ctx, host)
	return err == nil && len(ips) > 0
}

// NormalizeAccountSecret 自动去除首尾空白；对 Gmail 16 位应用专用密码自动去除中间空格。
func NormalizeAccountSecret(provider, email, secret string) string {
	trimmed := strings.TrimSpace(secret)
	lowerEmail := strings.ToLower(strings.TrimSpace(email))
	if provider == "gmail" || strings.HasSuffix(lowerEmail, "@gmail.com") || strings.HasSuffix(lowerEmail, "@googlemail.com") {
		if noSpaces := strings.Join(strings.Fields(trimmed), ""); len(noSpaces) == 16 {
			return noSpaces
		}
	}
	return trimmed
}

func ShouldSendIMAPID(provider, imapHost string) bool {
	if provider == "netease" || provider == "netease_exmail" {
		return true
	}
	h := strings.ToLower(strings.TrimSpace(imapHost))
	return strings.HasSuffix(h, ".qiye.163.com") || strings.HasSuffix(h, ".163.com") || strings.HasSuffix(h, ".126.com") || strings.HasSuffix(h, ".yeah.net")
}
