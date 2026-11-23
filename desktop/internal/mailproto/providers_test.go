package mailproto

import "testing"

func TestProviderPresetsAndEmailResolution(t *testing.T) {
	presets := ListProviderPresets()
	if len(presets) != 10 {
		t.Fatalf("期望内置 10 家服务商预设，实际: %d", len(presets))
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

func TestGmailAppPasswordWhitespaceNormalization(t *testing.T) {
	got := NormalizeAccountSecret("gmail", "tester@gmail.com", " abcd efgh ijkl mnop ")
	if got != "abcdefghijklmnop" {
		t.Fatalf("Gmail 16 位应用专用密码去空格失败: got=%q", got)
	}
	// 非 Gmail 的带横杠 Apple 专用密码应保持原样不误删连字符
	apple := NormalizeAccountSecret("icloud", "tester@icloud.com", "aaaa-bbbb-cccc-dddd")
	if apple != "aaaa-bbbb-cccc-dddd" {
		t.Fatalf("Apple 专用密码不应被误改: got=%q", apple)
	}
}

func TestDecodeHeaderTextGBK(t *testing.T) {
	// "=?GBK?B?1tDOxA==?=" => "中文"
	got := DecodeHeaderText("=?GBK?B?1tDOxA==?=")
	if got != "中文" {
		t.Fatalf("GBK 邮件头解码失败: got=%q", got)
	}
}
