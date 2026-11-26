package mailproto

import (
	"net"
	"testing"
)

func TestProviderPresetsAndEmailResolution(t *testing.T) {
	presets := ListProviderPresets()
	if len(presets) != 16 {
		t.Fatalf("期望内置 16 家服务商预设（9 常规 + 6 企业 + 1 通用 IMAP），实际: %d", len(presets))
	}
	if presets[len(presets)-1].ID != "imap" {
		t.Fatalf("末尾兜底预设必须保持为 imap，实际: %s", presets[len(presets)-1].ID)
	}
	if fallback := PresetByID("unknown-provider-id"); fallback.ID != "imap" {
		t.Fatalf("未知 ID 应回退 imap，实际: %s", fallback.ID)
	}

	p126 := ResolveProviderByEmail("dev@126.com")
	if p126.ID != "netease" || p126.DefaultImapHost != "imap.126.com" || !ShouldSendIMAPID(p126.ID, p126.DefaultImapHost) {
		t.Fatalf("126 邮箱识别或 RFC2971 ID 标记异常: %+v", p126)
	}

	pNaver := ResolveProviderByEmail("user@naver.com")
	if pNaver.ID != "nevermail" || pNaver.DefaultImapHost != "imap.naver.com" || pNaver.DefaultImapPort != 993 {
		t.Fatalf("韩国 Naver (@naver.com) 预设识别异常: %+v", pNaver)
	}

	pLinux := ResolveProviderByEmail("member@linux.do")
	if pLinux.ID != "linuxdo" || pLinux.DefaultImapHost != "mail.linux.do" || pLinux.DefaultSmtpHost != "smtp.linux.do" {
		t.Fatalf("Linux.do 预设识别异常: %+v", pLinux)
	}

	pFox := ResolveProviderByEmail("team@foxmail.com")
	if pFox.ID != "qq" || pFox.DefaultImapHost != "imap.qq.com" {
		t.Fatalf("Foxmail 应自动映射到 QQ 邮箱预设: %+v", pFox)
	}
}

func TestEnterpriseMXAutoDetectionAndIMAPID(t *testing.T) {
	cases := []struct {
		mxHost   string
		wantID   string
		wantImap string
		wantSmtp string
		wantVia  string
	}{
		{"mxbiz1.qq.com.", "tencent_exmail", "imap.exmail.qq.com", "smtp.exmail.qq.com", "mxbiz1.qq.com"},
		{"mxbiz2.qq.com.", "tencent_exmail", "imap.exmail.qq.com", "smtp.exmail.qq.com", "mxbiz2.qq.com"},
		{"mxn.mxhichina.com.", "aliyun_exmail", "imap.qiye.aliyun.com", "smtp.qiye.aliyun.com", "mxn.mxhichina.com"},
		{"hzmx01.mxmail.netease.com.", "netease_exmail", "imaphz.qiye.163.com", "smtphz.qiye.163.com", "hzmx01.mxmail.netease.com"},
		{"bjmx01.mxmail.netease.com.", "netease_exmail", "imap.qiye.163.com", "smtp.qiye.163.com", "bjmx01.mxmail.netease.com"},
		{"mx1.feishu.cn.", "feishu", "imap.feishu.cn", "smtp.feishu.cn", "mx1.feishu.cn"},
		{"mx1.larksuite.com.", "feishu", "imap.larksuite.com", "smtp.larksuite.com", "mx1.larksuite.com"},
		{"mx.263xmail.com.", "mail263", "imap.263.net", "smtp.263.net", "mx.263xmail.com"},
		{"mx.zoho.com.cn.", "zoho_exmail", "imappro.zoho.com.cn", "smtppro.zoho.com.cn", "mx.zoho.com.cn"},
		{"mx.zoho.com.", "zoho_exmail", "imappro.zoho.com", "smtppro.zoho.com", "mx.zoho.com"},
		{"mx.zoho.eu.", "zoho_exmail", "imappro.zoho.eu", "smtppro.zoho.eu", "mx.zoho.eu"},
		{"ganlion-cc.mail.protection.outlook.com.", "outlook", "outlook.office365.com", "smtp.office365.com", "ganlion-cc.mail.protection.outlook.com"},
		{"aspmx.l.google.com.", "gmail", "imap.gmail.com", "smtp.gmail.com", "aspmx.l.google.com"},
	}

	for _, tc := range cases {
		got, ok := MatchProviderByMXHost(tc.mxHost)
		if !ok {
			t.Fatalf("MX %q 未命中预期预设 %s", tc.mxHost, tc.wantID)
		}
		if got.ID != tc.wantID || got.DefaultImapHost != tc.wantImap || got.DefaultSmtpHost != tc.wantSmtp || got.DetectedVia != tc.wantVia {
			t.Fatalf("MX %q 映射结果不符: got=%+v", tc.mxHost, got)
		}
	}

	// 验证 ResolveProviderByEmail 通过注入 lookupMXFn 按最低 Pref 优先识别企业域名
	origLookup := lookupMXFn
	defer func() { lookupMXFn = origLookup }()
	lookupMXFn = func(domain string) ([]*net.MX, error) {
		if domain == "ganlion.cc" {
			return []*net.MX{
				{Host: "mxbiz2.qq.com.", Pref: 10},
				{Host: "mxbiz1.qq.com.", Pref: 5},
			}, nil
		}
		return nil, nil
	}
	exmail := ResolveProviderByEmail("xiarui@ganlion.cc")
	if exmail.ID != "tencent_exmail" || exmail.DetectedVia != "mxbiz1.qq.com" || !exmail.AutoAppendsSent {
		t.Fatalf("ResolveProviderByEmail(xiarui@ganlion.cc) 识别异常: %+v", exmail)
	}

	if !ShouldSendIMAPID("netease_exmail", "imap.custom.example") {
		t.Fatal("netease_exmail 必须启用 RFC2971 IMAP ID")
	}
	if !ShouldSendIMAPID("imap", "imaphz.qiye.163.com") || !ShouldSendIMAPID("imap", "imap.qiye.163.com") {
		t.Fatal(".qiye.163.com 节点必须启用 RFC2971 IMAP ID")
	}
}

func TestGmailAppPasswordWhitespaceNormalization(t *testing.T) {
	got := NormalizeAccountSecret("gmail", "tester@gmail.com", " abcd efgh ijkl mnop ")
	if got != "abcdefghijklmnop" {
		t.Fatalf("Gmail 16 位应用专用密码去空格失败: got=%q", got)
	}
	apple := NormalizeAccountSecret("icloud", "tester@icloud.com", "aaaa-bbbb-cccc-dddd")
	if apple != "aaaa-bbbb-cccc-dddd" {
		t.Fatalf("Apple 专用密码不应被误改: got=%q", apple)
	}
}

func TestDecodeHeaderTextGBK(t *testing.T) {
	got := DecodeHeaderText("=?GBK?B?1tDOxA==?=")
	if got != "中文" {
		t.Fatalf("GBK 邮件头解码失败: got=%q", got)
	}
}
