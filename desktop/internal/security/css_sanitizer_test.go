package security

import (
	"strings"
	"testing"
)

func TestSanitizeMailHTMLPreservesResponsiveStylesAndBlocksThreats(t *testing.T) {
	raw := `<html><head><style type="text/css">
		/* NetEase responsive button visibility */
		@import url("https://evil.example/track.css");
		@charset "utf-8";
		html, body { background-color: #f5f7fa; margin: 0; }
		.edm-btn-desktop { display: none !important; }
		.ntes-edm-mobile { display: none !important; }
		.edm-btn-webmail { display: inline-block; background: #2563eb; color: #ffffff; }
		.tracker { background-image: url(https://track.example/pixel.png); position: fixed; top: 0; }
		.legacy-xss { width: expression(alert(1)); background: url("javascript:alert(2)"); -moz-binding: url("http://x.test/b.xml#x"); }
		@media only screen and (max-width: 600px) {
			.ntes-edm-mobile { display: block !important; }
		}
	</style></head><body>
		<table><tr><th scope="col" colspan="2" id="hdr-status">Status</th></tr>
		<tr><td>
			<a class="edm-btn-webmail" href="https://mail.163.com/security">查看安全活动</a>
			<a class="edm-btn-desktop" href="https://mail.163.com/client">查看安全活动</a>
		</td></tr></table>
	</body></html>`

	cleaned, hasRemote := SanitizeMailHTML(raw, nil)
	if !hasRemote {
		t.Fatalf("expected hasRemote=true when CSS contains external url(https://...)")
	}
	if !strings.Contains(cleaned, "<style>") || !strings.Contains(cleaned, "</style>") {
		t.Fatalf("expected sanitized <style> block to be preserved: %s", cleaned)
	}
	if !strings.Contains(cleaned, ".edm-btn-desktop { display: none !important }") {
		t.Fatalf("expected .edm-btn-desktop display:none rule preserved, got: %s", cleaned)
	}
	if !strings.Contains(cleaned, `class="edm-btn-desktop"`) || !strings.Contains(cleaned, `class="edm-btn-webmail"`) {
		t.Fatalf("expected safe class attributes preserved, got: %s", cleaned)
	}
	if !strings.Contains(cleaned, `scope="col"`) || !strings.Contains(cleaned, `id="hdr-status"`) {
		t.Fatalf("expected th scope and safe id attributes preserved, got: %s", cleaned)
	}
	if !strings.Contains(cleaned, ".mail-html-inner") || strings.Contains(cleaned, "html, body") {
		t.Fatalf("expected html/body selectors rewritten to .mail-html-inner, got: %s", cleaned)
	}
	if !strings.Contains(cleaned, "@media only screen and (max-width: 600px)") {
		t.Fatalf("expected @media rule preserved, got: %s", cleaned)
	}
	if !strings.Contains(cleaned, "position: static") || strings.Contains(strings.ToLower(cleaned), "position: fixed") {
		t.Fatalf("expected position: fixed downgraded to static, got: %s", cleaned)
	}
	for _, forbidden := range []string{"@import", "@charset", "evil.example", "track.example", "expression(", "javascript:", "-moz-binding"} {
		if strings.Contains(strings.ToLower(cleaned), forbidden) {
			t.Fatalf("security violation: forbidden token %q remained in sanitized output: %s", forbidden, cleaned)
		}
	}
}

func TestSanitizeMailCSSBlocksStyleBreakoutAndEscapes(t *testing.T) {
	breakout := `<style>.ok { color: #333; } </style><script>alert(1)</script><style>.after { color: red; }</style><div class="ok">Safe</div>`
	cleaned, _ := SanitizeMailHTML(breakout, nil)
	if strings.Contains(strings.ToLower(cleaned), "<script") || strings.Contains(strings.ToLower(cleaned), "alert(1)") {
		t.Fatalf("style breakout XSS was not blocked: %s", cleaned)
	}

	escapedBreakout, _ := SanitizeMailCSS(`.x { color: red; } \3c /style\3e \3c script\3e alert(1)\3c /script\3e`)
	if strings.Contains(strings.ToLower(escapedBreakout), "</style") || strings.Contains(strings.ToLower(escapedBreakout), "<script") {
		t.Fatalf("CSS hex-escaped style breakout was not neutralized: %s", escapedBreakout)
	}
}

func TestEmailDomainDefensiveAngleBracketCleaning(t *testing.T) {
	if got := emailDomain(`<"腾讯企业邮箱"><10000@exmail.weixin.qq.com>`); got != "exmail.weixin.qq.com" {
		t.Fatalf("expected exmail.weixin.qq.com, got %q", got)
	}
	warn := EvaluatePhishing(PhishingCheckInput{
		SenderName:  `<"ҵ"><10000@exmail.weixin.qq.com>`,
		SenderEmail: `<"ҵ"><10000@exmail.weixin.qq.com>`,
		RawHeaders:  "Authentication-Results: mx.qq.com; spf=pass; dkim=pass; dmarc=pass\r\n",
	})
	if warn != nil {
		t.Fatalf("expected defensive emailDomain to prevent spoofing false-positive, got %+v", warn)
	}
}
