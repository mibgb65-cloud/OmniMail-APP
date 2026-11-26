package mailproto

import (
	"net"
	"sort"
	"strings"
)

// ResolveProviderByMXRecords 按 MX 优先级（Pref 升序）依次匹配主流企业邮箱与云邮局。
func ResolveProviderByMXRecords(records []*net.MX) (ProviderPreset, bool) {
	sorted := make([]*net.MX, 0, len(records))
	for _, r := range records {
		if r != nil && strings.TrimSpace(r.Host) != "" {
			sorted = append(sorted, r)
		}
	}
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].Pref < sorted[j].Pref })
	for _, rec := range sorted {
		if p, ok := MatchProviderByMXHost(rec.Host); ok {
			return p, true
		}
	}
	return ProviderPreset{}, false
}

// MatchProviderByMXHost 根据单条 MX 主机名匹配内置企业邮箱或云邮局预设，并回填 DetectedVia。
func MatchProviderByMXHost(rawHost string) (ProviderPreset, bool) {
	mxHost := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(rawHost), "."))
	if mxHost == "" {
		return ProviderPreset{}, false
	}
	withVia := func(id string) ProviderPreset {
		p := PresetByID(id)
		p.DetectedVia = mxHost
		return p
	}
	switch {
	case hasHostSuffix(mxHost, "exmail.qq.com", "mxbiz1.qq.com", "mxbiz2.qq.com"):
		return withVia("tencent_exmail"), true
	case hasHostSuffix(mxHost, "qiye.aliyun.com", "mxhichina.com"):
		return withVia("aliyun_exmail"), true
	case hasHostSuffix(mxHost, "mxmail.netease.com", "qiye.163.com"):
		p := withVia("netease_exmail")
		if !strings.Contains(mxHost, "hzmx") {
			p.DefaultImapHost, p.DefaultSmtpHost = "imap.qiye.163.com", "smtp.qiye.163.com"
		}
		return p, true
	case hasHostSuffix(mxHost, "feishu.cn"):
		return withVia("feishu"), true
	case hasHostSuffix(mxHost, "larksuite.com"):
		p := withVia("feishu")
		p.DefaultImapHost, p.DefaultSmtpHost = "imap.larksuite.com", "smtp.larksuite.com"
		return p, true
	case hasHostSuffix(mxHost, "263xmail.com", "263.net"):
		return withVia("mail263"), true
	case hasHostSuffix(mxHost, "zoho.com.cn"):
		return withVia("zoho_exmail"), true
	case hasHostSuffix(mxHost, "zoho.eu"):
		p := withVia("zoho_exmail")
		p.DefaultImapHost, p.DefaultSmtpHost = "imappro.zoho.eu", "smtppro.zoho.eu"
		return p, true
	case hasHostSuffix(mxHost, "zoho.com"):
		p := withVia("zoho_exmail")
		p.DefaultImapHost, p.DefaultSmtpHost = "imappro.zoho.com", "smtppro.zoho.com"
		return p, true
	case hasHostSuffix(mxHost, "mail.protection.outlook.com"):
		return withVia("outlook"), true
	case hasHostSuffix(mxHost, "google.com", "googlemail.com"):
		return withVia("gmail"), true
	default:
		return ProviderPreset{}, false
	}
}

func hasHostSuffix(host string, domains ...string) bool {
	for _, d := range domains {
		if host == d || strings.HasSuffix(host, "."+d) {
			return true
		}
	}
	return false
}
