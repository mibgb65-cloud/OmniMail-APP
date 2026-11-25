package mailproto_test

import (
	"bytes"
	"testing"

	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/traditionalchinese"

	"omnimail/internal/mailproto"
	"omnimail/internal/security"
)

func TestRawGB18030FromHeaderAndNoFalsePhishingWarning(t *testing.T) {
	gbName, err := simplifiedchinese.GB18030.NewEncoder().Bytes([]byte("腾讯企业邮箱"))
	if err != nil {
		t.Fatal(err)
	}

	variants := [][]byte{
		append(append([]byte(`From: <"`), gbName...), []byte(`"><10000@exmail.weixin.qq.com>`)...),
		append(append([]byte(`From: <`), gbName...), []byte(`><10000@exmail.weixin.qq.com>`)...),
		append(append([]byte(`From: `), gbName...), []byte(`<10000@exmail.weixin.qq.com>`)...),
	}

	for i, fromLine := range variants {
		var raw bytes.Buffer
		raw.Write(fromLine)
		raw.WriteString("\r\nTo: =?gb18030?B?z8LU2A==?=<admin@corp.example.com>, ops@corp.example.com\r\n")
		raw.WriteString("Subject: =?gb18030?B?08q12rXas8nM7MPD?=\r\n")
		raw.WriteString("Authentication-Results: mx.qq.com; spf=pass; dkim=pass; dmarc=pass\r\n")
		raw.WriteString("Content-Type: text/plain; charset=\"utf-8\"\r\n\r\n异地登录提醒正文")

		parsed, err := mailproto.ParseRawMessage(raw.Bytes())
		if err != nil {
			t.Fatalf("variant %d ParseRawMessage error: %v", i, err)
		}
		if parsed.Sender.Name != "腾讯企业邮箱" {
			t.Fatalf("variant %d expected Sender.Name='腾讯企业邮箱', got %q", i, parsed.Sender.Name)
		}
		if parsed.Sender.Email != "10000@exmail.weixin.qq.com" {
			t.Fatalf("variant %d expected Sender.Email='10000@exmail.weixin.qq.com', got %q", i, parsed.Sender.Email)
		}
		if len(parsed.To) != 2 || parsed.To[0].Email != "admin@corp.example.com" || parsed.To[1].Email != "ops@corp.example.com" {
			t.Fatalf("variant %d unexpected To list: %+v", i, parsed.To)
		}

		warn := security.EvaluatePhishing(security.PhishingCheckInput{
			SenderName:  parsed.Sender.Name,
			SenderEmail: parsed.Sender.Email,
			RawHeaders:  parsed.RawHeaders,
			BodyHTML:    parsed.BodyHTML,
		})
		if warn != nil {
			t.Fatalf("variant %d expected nil phishing warning, got %+v", i, warn)
		}
	}
}

func TestEnsureUTF8HeaderBytesWithHintAndFallback(t *testing.T) {
	big5Bytes, err := traditionalchinese.Big5.NewEncoder().String("系統安全通知")
	if err != nil {
		t.Fatal(err)
	}
	if got := mailproto.EnsureUTF8HeaderBytes(big5Bytes, "big5"); got != "系統安全通知" {
		t.Fatalf("expected Big5 hint decode '系統安全通知', got %q", got)
	}

	gbBytes, err := simplifiedchinese.GB18030.NewEncoder().String("企业邮局通知")
	if err != nil {
		t.Fatal(err)
	}
	if got := mailproto.EnsureUTF8HeaderBytes(gbBytes, ""); got != "企业邮局通知" {
		t.Fatalf("expected GB18030 fallback decode '企业邮局通知', got %q", got)
	}
}
