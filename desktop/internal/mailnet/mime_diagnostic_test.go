package mailnet

import (
	"errors"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestMIMEDiagnosticKeepsSafeFailureLocation(t *testing.T) {
	for _, test := range []struct{ name, raw, reason string }{
		{"header", "private invalid header\r\n\r\nprivate-body", "mime_header_invalid"},
		{"charset", "Content-Type: text/plain; charset=private-unknown\r\n\r\nprivate-body", "mime_charset_unknown"},
		{"text", "Content-Transfer-Encoding: base64\r\n\r\n%%private-invalid%%", "mime_base64_invalid"},
		{"padding", "Content-Transfer-Encoding: base64\r\n\r\naGVsbG8", "mime_base64_truncated"},
		{"quoted_printable", "Content-Transfer-Encoding: quoted-printable\r\n\r\nprivate\x00body", "mime_quoted_printable_invalid"},
		{"part", "Content-Type: multipart/mixed; boundary=b\r\n\r\n--b\r\nprivate invalid header\r\n\r\nx\r\n--b--\r\n", "mime_part_invalid"},
	} {
		t.Run(test.name, func(t *testing.T) {
			_, err := decodeForTest([]byte(test.raw))
			err = (&session{ctx: t.Context()}).bodyError(err, nil)
			var diagnostic interface{ DiagnosticCode() string }
			if !errors.Is(err, domain.ErrProtocol) || !errors.As(err, &diagnostic) || diagnostic.DiagnosticCode() != test.reason {
				t.Fatal("MIME 失败没有精确的安全阶段分类")
			}
			if err.Error() != domain.ErrProtocol.Error() || strings.Contains(err.Error(), "private") {
				t.Fatal("MIME 错误泄漏原始内容")
			}
		})
	}
}
