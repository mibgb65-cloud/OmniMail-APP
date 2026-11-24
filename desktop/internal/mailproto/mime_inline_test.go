package mailproto

import (
	"bytes"
	"strings"
	"testing"
)

var tinyPNGBytes = []byte{
	0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
	0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
}

func TestBuildRFC5322PlainTextOnly(t *testing.T) {
	built, err := BuildRFC5322(BuildMessageInput{
		FromName:  "Alice",
		FromEmail: "alice@example.com",
		To:        []string{"bob@example.com"},
		Subject:   "纯文本测试",
		BodyText:  "第一行\n第二行",
	})
	if err != nil {
		t.Fatalf("BuildRFC5322 plain failed: %v", err)
	}
	rawStr := string(built.RawBytes)
	if !strings.Contains(strings.ToLower(rawStr), "content-type: text/plain") {
		t.Fatalf("纯文本邮件应生成 text/plain，实际头:\n%s", rawStr)
	}
	if strings.Contains(strings.ToLower(rawStr), "multipart/") {
		t.Fatalf("纯文本无附件不应生成 multipart，实际:\n%s", rawStr)
	}
	parsed, err := ParseRawMessage(built.RawBytes)
	if err != nil {
		t.Fatalf("ParseRawMessage failed: %v", err)
	}
	if !strings.Contains(parsed.BodyText, "第一行") || !strings.Contains(parsed.BodyText, "第二行") {
		t.Fatalf("纯文本往返解析不匹配: %q", parsed.BodyText)
	}
}

func TestBuildRFC5322RichHTMLAlternative(t *testing.T) {
	built, err := BuildRFC5322(BuildMessageInput{
		FromEmail: "alice@example.com",
		To:        []string{"bob@example.com"},
		Subject:   "富文本测试",
		BodyText:  "你好 OmniMail",
		BodyHTML:  "<p>你好 <strong>OmniMail</strong></p>",
	})
	if err != nil {
		t.Fatalf("BuildRFC5322 rich html failed: %v", err)
	}
	low := strings.ToLower(string(built.RawBytes))
	if !strings.Contains(low, "multipart/alternative") {
		t.Fatalf("富文本邮件应生成 multipart/alternative")
	}
	if strings.Contains(low, "multipart/related") || strings.Contains(low, "multipart/mixed") {
		t.Fatalf("无内嵌图与附件时不应包裹 related/mixed")
	}
	parsed, err := ParseRawMessage(built.RawBytes)
	if err != nil {
		t.Fatalf("ParseRawMessage failed: %v", err)
	}
	if !strings.Contains(parsed.BodyHTML, "<strong>OmniMail</strong>") {
		t.Fatalf("HTML 正文丢失: %q", parsed.BodyHTML)
	}
	if !strings.Contains(parsed.BodyText, "你好 OmniMail") {
		t.Fatalf("纯文本降级正文丢失: %q", parsed.BodyText)
	}
}

func TestBuildRFC5322InlineImageRelated(t *testing.T) {
	built, err := BuildRFC5322(BuildMessageInput{
		FromEmail: "alice@example.com",
		To:        []string{"bob@example.com"},
		Subject:   "内嵌图测试",
		BodyText:  "请查看截图",
		BodyHTML:  `<p>请查看截图</p><p><img src="/omnimail-cid/dimg-1001" data-cid="img-1@omnimail.local" /></p>`,
		InlineImages: []InlineImage{
			{
				AttachmentID: "dimg-1001",
				ContentID:    "img-1@omnimail.local",
				Filename:     "screen.png",
				MimeType:     "image/png",
				Data:         tinyPNGBytes,
			},
			{
				AttachmentID: "dimg-unused",
				ContentID:    "unused@omnimail.local",
				Filename:     "unused.png",
				MimeType:     "image/png",
				Data:         tinyPNGBytes,
			},
		},
	})
	if err != nil {
		t.Fatalf("BuildRFC5322 related failed: %v", err)
	}
	raw := string(built.RawBytes)
	low := strings.ToLower(raw)
	if !strings.Contains(low, "multipart/related") || !strings.Contains(low, "multipart/alternative") {
		t.Fatalf("带内嵌图邮件应包含 multipart/related 与 multipart/alternative")
	}
	if strings.Contains(low, "multipart/mixed") {
		t.Fatalf("无普通附件时不应包裹 multipart/mixed")
	}
	if strings.Contains(raw, "/omnimail-cid/dimg-1001") {
		t.Fatalf("未将 /omnimail-cid/ 替换为 cid: 引用")
	}
	if !strings.Contains(raw, "Content-Id: <img-1@omnimail.local>") && !strings.Contains(low, "content-id: <img-1@omnimail.local>") {
		t.Fatalf("缺少标准 Content-ID 头")
	}
	parsed, err := ParseRawMessage(built.RawBytes)
	if err != nil {
		t.Fatalf("ParseRawMessage failed: %v", err)
	}
	if !strings.Contains(parsed.BodyHTML, `src="cid:img-1@omnimail.local"`) {
		t.Fatalf("解析后 HTML 未包含 cid 引用: %q", parsed.BodyHTML)
	}
	if len(parsed.Attachments) != 1 || !parsed.Attachments[0].IsInline || parsed.Attachments[0].ContentID != "img-1@omnimail.local" {
		t.Fatalf("内嵌图分部解析不符合预期（应过滤未引用图片）: %+v", parsed.Attachments)
	}
	if !bytes.Equal(parsed.Attachments[0].Data, tinyPNGBytes) {
		t.Fatalf("内嵌图二进制数据往返不一致")
	}
}

func TestBuildRFC5322InlineImageAndRegularAttachmentMixed(t *testing.T) {
	pdfBytes := []byte("%PDF-1.4 sample payload")
	built, err := BuildRFC5322(BuildMessageInput{
		FromEmail: "alice@example.com",
		To:        []string{"bob@example.com"},
		Subject:   "混发内嵌图与普通附件",
		BodyText:  "正文含图并附带 PDF",
		BodyHTML:  `<p>正文含图：<img src="/omnimail-cid/dimg-2002" /></p>`,
		InlineImages: []InlineImage{
			{
				AttachmentID: "dimg-2002",
				ContentID:    "img-2@omnimail.local",
				Filename:     "chart.png",
				MimeType:     "image/png",
				Data:         tinyPNGBytes,
			},
		},
		Attachments: []OutgoingAttachment{
			{
				Filename: "quarterly-report.pdf",
				MimeType: "application/pdf",
				Data:     pdfBytes,
			},
		},
	})
	if err != nil {
		t.Fatalf("BuildRFC5322 mixed+related failed: %v", err)
	}
	low := strings.ToLower(string(built.RawBytes))
	if !strings.Contains(low, "multipart/mixed") || !strings.Contains(low, "multipart/related") || !strings.Contains(low, "multipart/alternative") {
		t.Fatalf("混发邮件必须包含 mixed -> related -> alternative 三层结构")
	}
	parsed, err := ParseRawMessage(built.RawBytes)
	if err != nil {
		t.Fatalf("ParseRawMessage failed: %v", err)
	}
	var inlineFound, attFound bool
	for _, a := range parsed.Attachments {
		if a.IsInline && a.ContentID == "img-2@omnimail.local" && bytes.Equal(a.Data, tinyPNGBytes) {
			inlineFound = true
		}
		if !a.IsInline && a.Filename == "quarterly-report.pdf" && bytes.Equal(a.Data, pdfBytes) {
			attFound = true
		}
	}
	if !inlineFound || !attFound {
		t.Fatalf("混发解析缺少内嵌图或普通附件: inline=%v att=%v all=%+v", inlineFound, attFound, parsed.Attachments)
	}
}
