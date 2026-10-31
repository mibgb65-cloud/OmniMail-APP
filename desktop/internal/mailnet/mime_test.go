package mailnet

import (
	"bytes"
	"errors"
	"io"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
)

func decodeForTest(raw []byte) (domain.DecodedMail, error) {
	return decodeReader(bytes.NewReader(raw), int64(len(raw)), func(name, kind string, reader io.Reader) (domain.DecodedAttachment, error) {
		data, err := io.ReadAll(reader)
		return domain.DecodedAttachment{Filename: name, MIME: kind, Data: data}, err
	})
}

func TestDecodeMIMEAndSafeHTMLText(t *testing.T) {
	raw := "MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=b\r\n\r\n" +
		"--b\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Hello</p><script>bad()</script><img src=\"https://tracking.invalid\">\r\n" +
		"--b\r\nContent-Type: application/octet-stream\r\nContent-Disposition: attachment; filename=\"../../file.bin\"\r\nContent-Transfer-Encoding: base64\r\n\r\naGVsbG8=\r\n--b--\r\n"
	decoded, err := decodeForTest([]byte(raw))
	if err != nil || !strings.Contains(decoded.Text, "Hello") || strings.Contains(decoded.Text, "bad()") ||
		len(decoded.Attachments) != 1 || string(decoded.Attachments[0].Data) != "hello" {
		t.Fatalf("MIME 解析失败：%v", err)
	}
	// 文件名只是元数据，路径安全由仓储生成哈希路径保证，不在 MIME 层擅自解释为本机路径。
	if decoded.Attachments[0].Filename != "../../file.bin" {
		t.Fatal("附件显示名意外变更")
	}
	if _, err := decodeForTest(make([]byte, maxRawBytes+1)); !errors.Is(err, domain.ErrTooLarge) {
		t.Fatal("原始邮件大小未限制")
	}
	if got := bounded("中文中文", 5); got != "中" {
		t.Fatalf("截断 UTF8 不完整：%q", got)
	}
}

func TestDecodePreservesHTMLAndCID(t *testing.T) {
	raw := "MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary=b\r\n\r\n" +
		"--b\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<table><tr><td>内容<img src=\"cid:logo@test\"></td></tr></table>\r\n" +
		"--b\r\nContent-Type: image/png\r\nContent-ID: <logo@test>\r\nContent-Disposition: inline; filename=logo.png\r\n\r\nimage-bytes\r\n--b--\r\n"
	got, err := decodeForTest([]byte(raw))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(got.HTML, "<table>") || !strings.Contains(got.Text, "内容") ||
		len(got.Attachments) != 1 || got.Attachments[0].ContentID != "logo@test" {
		t.Fatal("HTML 或 CID 图片关联丢失")
	}
}

func TestHTMLBudgetCountsOriginalNotStrippedText(t *testing.T) {
	raw := "Content-Type: text/html; charset=utf-8\r\n\r\n" + strings.Repeat("<b></b>", maxTextBytes/7+1)
	if _, err := decodeForTest([]byte(raw)); !errors.Is(err, domain.ErrTooLarge) {
		t.Fatal("HTML 标签绕过正文预算")
	}
}
