package mailnet

import (
	"errors"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestCompleteMIMEWithoutFinalBoundaryPreservesAllTextAndHTML(t *testing.T) {
	raw := "Content-Type: multipart/alternative; boundary=b\r\n\r\n" +
		"--b\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n合成文字\r\n" +
		"--b\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>合成 HTML</p>"
	body, err := decodeForTest([]byte(raw))
	if err != nil || !strings.Contains(body.Text, "合成文字") || body.HTML != "<p>合成 HTML</p>" {
		t.Fatal("完整 literal 末尾缺结构边界导致全部正文被拒绝")
	}
}

func TestBoundaryCompatibilityDoesNotAcceptMissingPartsOrInvalidText(t *testing.T) {
	for _, raw := range []string{
		"Content-Type: multipart/mixed; boundary=b\r\n\r\nnot a MIME part",
		"Content-Type: multipart/mixed; boundary=b\r\n\r\n--b\r\nprivate invalid header\r\n\r\nx",
		"Content-Transfer-Encoding: base64\r\n\r\n%%invalid%%",
		"Content-Transfer-Encoding: base64\r\n\r\naGVsbG8",
	} {
		if _, err := decodeForTest([]byte(raw)); !errors.Is(err, domain.ErrProtocol) {
			t.Fatal("边界兼容放宽了无效/缺失部件或编码完整性")
		}
	}
	raw := "Content-Type: multipart/mixed; boundary=b\r\n\r\n--b\r\nContent-Type: text/plain\r\n\r\n" + strings.Repeat("x", maxTextBytes+1)
	if _, err := decodeForTest([]byte(raw)); !errors.Is(err, domain.ErrTooLarge) {
		t.Fatal("边界兼容绕过正文上限")
	}
}

func TestMIMEBoundaryCompletionStillRequiresFullIMAPLiteralAndFetch(t *testing.T) {
	for _, response := range []string{"complete-multipart", "truncated-multipart"} {
		t.Run(response, func(t *testing.T) {
			value, _ := failureSession(t, t.Context(), "UID FETCH", response)
			if _, _, err := value.Select("INBOX"); err != nil {
				t.Fatal("无法选择合成测试邮箱")
			}
			body, err := value.Body(1, nil)
			if response == "truncated-multipart" {
				if !errors.Is(err, domain.ErrNetwork) {
					t.Fatal("MIME 边界补全掩盖了真实网络截断")
				}
			} else if err != nil || !strings.Contains(body.Text, "synthetic complete text") {
				t.Fatalf("完整 literal 缺终结结构时未兼容：%v", err)
			}
		})
	}
}
