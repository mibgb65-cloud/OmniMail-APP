package security

import (
	"net/url"
	"path/filepath"
	"regexp"
	"strings"
)

type SecurityWarningResult struct {
	Level  string `json:"level"`
	Title  string `json:"title"`
	Detail string `json:"detail"`
	SPF    string `json:"spf"`
	DKIM   string `json:"dkim"`
	DMARC  string `json:"dmarc"`
}

type PhishingCheckInput struct {
	SenderName      string
	SenderEmail     string
	ReplyToEmails   []string
	RawHeaders      string
	BodyHTML        string
	AttachmentExts  []string
	AttachmentNames []string
}

var (
	reAuthMech   = regexp.MustCompile(`(?i)\b(spf|dkim|dmarc)\s*=\s*(pass|fail|softfail|neutral|none|temperror|permerror)\b`)
	reAnchorPair = regexp.MustCompile(`(?is)<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>(.*?)</a>`)
	reEmailInTxt = regexp.MustCompile(`[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})`)
	reStripTag   = regexp.MustCompile(`(?s)<[^>]+>`)
	dangerExts   = map[string]bool{
		"exe": true, "scr": true, "bat": true, "cmd": true,
		"vbs": true, "js": true, "iso": true, "lnk": true, "com": true, "msi": true,
	}
)

// EvaluatePhishing 纯本地零外网解析 SPF/DKIM/DMARC 并执行 6 维启发式钓鱼检测。
func EvaluatePhishing(in PhishingCheckInput) *SecurityWarningResult {
	spf, dkim, dmarc := ParseAuthResults(in.RawHeaders)
	fromDom := emailDomain(in.SenderEmail)

	var reasons []string
	level := ""
	elevate := func(next, reason string) {
		reasons = append(reasons, reason)
		if next == "danger" || level == "" {
			level = next
		}
	}

	// 1. 认证失败判定（遵循 DMARC 对齐原则：dmarc=pass 且 dkim=pass 时不因转发导致的 spf fail/softfail 误报）
	if dmarc == "fail" || (spf == "fail" && dkim == "fail") {
		elevate("danger", "发件域身份认证未通过（DMARC/SPF+DKIM 校验失败），极可能为伪造发件人")
	} else if dmarc != "pass" && (spf == "fail" || spf == "softfail" || dkim == "fail") {
		elevate("warning", "部分发件服务器签名校验未通过，请谨慎核实对方身份")
	}

	// 2. 显示名伪装（Display Name Spoofing）
	if m := reEmailInTxt.FindStringSubmatch(in.SenderName); len(m) == 2 {
		spoofDom := strings.ToLower(m[1])
		if fromDom != "" && !sameRegistrableDomain(spoofDom, fromDom) {
			elevate("danger", "发件人显示名伪装为其他域名邮箱（"+spoofDom+"），与真实发件域不一致")
		}
	}

	// 3. Punycode 国际化同形异义字域名
	if strings.Contains(fromDom, "xn--") || strings.Contains(strings.ToLower(in.BodyHTML), "://xn--") {
		elevate("danger", "检测到 Punycode (xn--) 同形异义字混淆域名，警惕仿冒知名机构")
	}

	// 4. Reply-To 跨域名劫持
	for _, rt := range in.ReplyToEmails {
		rtDom := emailDomain(rt)
		if rtDom != "" && fromDom != "" && !sameRegistrableDomain(rtDom, fromDom) && dkim != "pass" {
			elevate("warning", "回复地址域名（"+rtDom+"）与发件人域名不一致")
			break
		}
	}

	// 5. HTML 锚文本 URL 与真实跳转域名不一致
	for _, pair := range reAnchorPair.FindAllStringSubmatch(in.BodyHTML, 25) {
		hrefDom := urlDomain(pair[1])
		visText := strings.TrimSpace(reStripTag.ReplaceAllString(pair[2], ""))
		if strings.HasPrefix(strings.ToLower(visText), "http://") || strings.HasPrefix(strings.ToLower(visText), "https://") {
			visDom := urlDomain(visText)
			if hrefDom != "" && visDom != "" && !sameRegistrableDomain(hrefDom, visDom) {
				elevate("danger", "正文链接显示为 "+visDom+"，实际指向可疑域名 "+hrefDom)
				break
			}
		}
	}

	// 6. 高危可执行附件或双扩展名伪装
	for _, fn := range in.AttachmentNames {
		low := strings.ToLower(strings.TrimSpace(fn))
		ext := strings.TrimPrefix(filepath.Ext(low), ".")
		if dangerExts[ext] {
			elevate("danger", "包含高危可执行或脚本附件（."+ext+"），切勿盲目双击运行")
			break
		}
		base := strings.TrimSuffix(low, "."+ext)
		if subExt := strings.TrimPrefix(filepath.Ext(base), "."); subExt != "" && dangerExts[ext] {
			elevate("danger", "检测到双扩展名伪装附件（"+fn+"）")
			break
		}
	}
	for _, rawExt := range in.AttachmentExts {
		ext := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(rawExt)), ".")
		if dangerExts[ext] && level != "danger" {
			elevate("danger", "包含高危可执行或脚本附件（."+ext+"）")
			break
		}
	}

	if level == "" {
		return nil
	}
	title := "请注意核实发件人身份与链接安全"
	if level == "danger" {
		title = "高危钓鱼或欺诈邮件预警"
	}
	return &SecurityWarningResult{
		Level:  level,
		Title:  title,
		Detail: strings.Join(reasons, "；") + "。",
		SPF:    spf,
		DKIM:   dkim,
		DMARC:  dmarc,
	}
}

func ParseAuthResults(rawHeaders string) (spf, dkim, dmarc string) {
	spf, dkim, dmarc = "unknown", "unknown", "unknown"
	unfolded := strings.ReplaceAll(strings.ReplaceAll(rawHeaders, "\r\n ", " "), "\n ", " ")
	unfolded = strings.ReplaceAll(strings.ReplaceAll(unfolded, "\r\n\t", " "), "\n\t", " ")
	for _, line := range strings.Split(strings.ReplaceAll(unfolded, "\r\n", "\n"), "\n") {
		low := strings.ToLower(strings.TrimSpace(line))
		if strings.HasPrefix(low, "authentication-results:") || strings.HasPrefix(low, "arc-authentication-results:") {
			for _, m := range reAuthMech.FindAllStringSubmatch(low, -1) {
				switch m[1] {
				case "spf":
					if spf == "unknown" {
						spf = m[2]
					}
				case "dkim":
					if dkim == "unknown" {
						dkim = m[2]
					}
				case "dmarc":
					if dmarc == "unknown" {
						dmarc = m[2]
					}
				}
			}
		} else if strings.HasPrefix(low, "received-spf:") && spf == "unknown" {
			rest := strings.TrimSpace(strings.TrimPrefix(low, "received-spf:"))
			for _, st := range []string{"pass", "softfail", "fail", "neutral", "none"} {
				if strings.HasPrefix(rest, st) {
					spf = st
					break
				}
			}
		}
	}
	return spf, dkim, dmarc
}

func emailDomain(addr string) string {
	s := strings.ToLower(strings.TrimSpace(addr))
	if at := strings.LastIndexByte(s, '@'); at >= 0 && at < len(s)-1 {
		return s[at+1:]
	}
	return ""
}

func urlDomain(raw string) string {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return ""
	}
	return strings.ToLower(u.Hostname())
}

func sameRegistrableDomain(a, b string) bool {
	if a == b {
		return true
	}
	return strings.HasSuffix(a, "."+b) || strings.HasSuffix(b, "."+a)
}
