package mailnet

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestLargeMailTextAndRawBoundaries(t *testing.T) {
	for _, size := range []int{(1 << 20) + 1, domain.MaxMessageTextBytes, domain.MaxMessageTextBytes + 1} {
		t.Run(fmt.Sprint(size), func(t *testing.T) {
			raw := "Content-Type: text/plain; charset=utf-8\r\n\r\n" + strings.Repeat("x", size)
			body, err := decodeForTest([]byte(raw))
			if size <= domain.MaxMessageTextBytes {
				if err != nil || len(body.Text) != size {
					t.Fatalf("有效大正文未完整保留：%v / %d", err, len(body.Text))
				}
			} else if !errors.Is(err, domain.ErrMessageTextTooLarge) {
				t.Fatalf("正文未按具体原因拒绝：%v", err)
			}
		})
	}
	// 先检查 literal 声明长度，不为明显超限邮件分配 100 MiB 缓冲。
	if _, err := decodeReader(strings.NewReader(""), domain.MaxRawMessageBytes+1, nil); !errors.Is(err, domain.ErrRawMessageTooLarge) {
		t.Fatalf("未按原始邮件上限拒绝：%v", err)
	}
}

type zeroMailStream struct{}

func (zeroMailStream) Read(data []byte) (int, error) { clear(data); return len(data), nil }

type largeLiteral struct {
	io.Reader
	size int64
}

func (r largeLiteral) Size() int64 { return r.size }

func TestHundredMiBRawLiteralAndFiftyMiBAttachmentBoundaries(t *testing.T) {
	// 大 epilogue 逐块消费，不在测试或正式路径分配 100 MiB 原始邮件副本。
	prefix := "Content-Type: multipart/mixed; boundary=b\r\n\r\n--b\r\nContent-Type: text/plain\r\n\r\nok\r\n--b--\r\n"
	literal := largeLiteral{
		Reader: io.MultiReader(strings.NewReader(prefix), io.LimitReader(zeroMailStream{}, domain.MaxRawMessageBytes-int64(len(prefix)))),
		size:   domain.MaxRawMessageBytes,
	}
	value := &session{ctx: context.Background()}
	body, err := value.decodeLiteral(literal, nil)
	if err != nil || body.Text != "ok" {
		t.Fatalf("100 MiB 完整 literal 被旧预算阻断：%v", err)
	}
	for _, size := range []int64{domain.MaxAttachmentBytes, domain.MaxAttachmentBytes + 1} {
		_, err := decodeAttachment("large.bin", "application/octet-stream", io.LimitReader(zeroMailStream{}, size),
			func(name, kind string, reader io.Reader) (domain.DecodedAttachment, error) {
				count, err := io.Copy(io.Discard, reader)
				return domain.DecodedAttachment{Filename: name, MIME: kind, Size: count}, err
			})
		if size == domain.MaxAttachmentBytes && err != nil || size > domain.MaxAttachmentBytes && !errors.Is(err, domain.ErrAttachmentTooLarge) {
			t.Fatalf("附件解码边界错误：%d / %v", size, err)
		}
	}
}

func TestMIMEPartCountStillHasAnIndependentLimit(t *testing.T) {
	for _, count := range []int{domain.MaxMessageParts, domain.MaxMessageParts + 1} {
		var raw strings.Builder
		raw.WriteString("Content-Type: multipart/mixed; boundary=b\r\n\r\n")
		for range count {
			raw.WriteString("--b\r\nContent-Type: text/plain\r\n\r\nx\r\n")
		}
		raw.WriteString("--b--\r\n")
		_, err := decodeForTest([]byte(raw.String()))
		if count <= domain.MaxMessageParts && err != nil || count > domain.MaxMessageParts && !errors.Is(err, domain.ErrTooManyMailParts) {
			t.Fatalf("MIME 部件边界错误：%d / %v", count, err)
		}
	}
}

func TestMultipartTextSharesBudgetAndHTMLFallbackDoesNotDuplicateLargeBody(t *testing.T) {
	raw := "Content-Type: multipart/alternative; boundary=b\r\n\r\n" +
		"--b\r\nContent-Type: text/plain\r\n\r\n" + strings.Repeat("x", 4<<20) +
		"\r\n--b\r\nContent-Type: text/html\r\n\r\n" + strings.Repeat("y", (4<<20)+1) + "\r\n--b--\r\n"
	if _, err := decodeForTest([]byte(raw)); !errors.Is(err, domain.ErrMessageTextTooLarge) {
		t.Fatalf("纯文本与 HTML 绕过总预算：%v", err)
	}
	html := strings.Repeat("x", domain.MaxMessageTextBytes)
	body, err := decodeForTest([]byte("Content-Type: text/html\r\n\r\n" + html))
	if err != nil || body.HTML != html || len(body.Text)+len(body.HTML) > domain.MaxMessageTextBytes {
		t.Fatalf("大 HTML 被截断或派生副本挤占预算：%v", err)
	}
	if maxHeaderBytes != 1<<20 {
		t.Fatal("不能随正文上限扩大邮件头预算")
	}
}
