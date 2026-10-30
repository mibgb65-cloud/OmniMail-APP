package mailnet

import (
	"io"
	"strings"
	"unicode"
	"unicode/utf8"

	"omnimail/desktop/internal/domain"

	_ "github.com/emersion/go-message/charset"
	"github.com/emersion/go-message/mail"
	"golang.org/x/net/html"
)

const (
	maxRawBytes  = 40 << 20
	maxPartBytes = 25 << 20
	maxTextBytes = 1 << 20
)

// 这里保留一个有界解码循环，统一累计纯文本与 HTML 回退预算并立即调用流式 sink；
// 不把共享预算拆成互不知情的处理器，避免 multipart/alternative 绕过总大小限制。
func decodeReader(source io.Reader, size int64, sink domain.AttachmentSink) (domain.DecodedMail, error) {
	result := domain.DecodedMail{Attachments: []domain.DecodedAttachment{}}
	if size > maxRawBytes {
		return result, domain.ErrTooLarge
	}
	reader, err := mail.CreateReader(io.LimitReader(source, maxRawBytes+1))
	if err != nil {
		return result, domain.ErrProtocol
	}
	textBytes := 0
	for count := 0; ; count++ {
		if count >= 128 {
			return result, domain.ErrTooLarge
		}
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			return result, domain.ErrProtocol
		}
		switch header := part.Header.(type) {
		case *mail.InlineHeader:
			contentType, _, err := header.ContentType()
			if err != nil {
				contentType = "text/plain"
			}
			if contentType == "text/plain" || contentType == "text/html" {
				data, err := io.ReadAll(io.LimitReader(part.Body, maxTextBytes+1))
				if err != nil {
					return result, domain.ErrProtocol
				}
				textBytes += len(data)
				if textBytes > maxTextBytes {
					return result, domain.ErrTooLarge
				}
				text := strings.ToValidUTF8(string(data), "\uFFFD")
				if contentType == "text/plain" {
					result.Text += text
				} else {
					result.HTML += text
				}
			} else {
				_, params, _ := header.ContentType()
				filename := params["name"]
				if filename == "" {
					filename = "inline.bin"
				}
				if !utf8.ValidString(filename) || len(filename) > 256 || strings.ContainsFunc(filename, unicode.IsControl) {
					return result, domain.ErrProtocol
				}
				attachment, err := decodeAttachment(filename, bounded(contentType, 128), part.Body, sink)
				if err != nil {
					return result, err
				}
				attachment.ContentID = strings.TrimSpace(strings.Trim(header.Get("Content-ID"), "<>"))
				if !validContentID(attachment.ContentID) {
					return result, domain.ErrProtocol
				}
				result.Attachments = append(result.Attachments, attachment)
			}
		case *mail.AttachmentHeader:
			name, err := header.Filename()
			if err != nil || name == "" {
				name = "attachment.bin"
			}
			kind, _, err := header.ContentType()
			if err != nil {
				kind = "application/octet-stream"
			}
			if !utf8.ValidString(name) || len(name) > 256 {
				return result, domain.ErrProtocol
			}
			attachment, err := decodeAttachment(name, bounded(kind, 128), part.Body, sink)
			if err != nil {
				return result, err
			}
			attachment.ContentID = strings.TrimSpace(strings.Trim(header.Get("Content-ID"), "<>"))
			if !validContentID(attachment.ContentID) {
				return result, domain.ErrProtocol
			}
			result.Attachments = append(result.Attachments, attachment)
		}
	}
	if result.Text == "" {
		result.Text = htmlText(result.HTML)
	}
	return result, nil
}

func decodeAttachment(name, kind string, reader io.Reader, sink domain.AttachmentSink) (domain.DecodedAttachment, error) {
	if sink != nil {
		return sink(name, kind, io.LimitReader(reader, maxPartBytes+1))
	}
	return domain.DecodedAttachment{}, domain.ErrProtocol
}

func validContentID(value string) bool {
	return len(value) <= 998 && utf8.ValidString(value) && !strings.ContainsAny(value, "<>") && !strings.ContainsFunc(value, unicode.IsControl)
}

// 提供离线与安全降级的纯文本；HTML 单独保留，交给安全清洗与沙箱阅读器。
func htmlText(source string) string {
	tokenizer := html.NewTokenizer(strings.NewReader(source))
	var output strings.Builder
	skip := 0
	for {
		switch tokenizer.Next() {
		case html.ErrorToken:
			return output.String()
		case html.StartTagToken:
			tag, _ := tokenizer.TagName()
			switch string(tag) {
			case "script", "style", "head":
				skip++
			case "p", "div", "br":
				if skip == 0 {
					output.WriteByte('\n')
				}
			}
		case html.EndTagToken:
			tag, _ := tokenizer.TagName()
			if skip > 0 && (string(tag) == "script" || string(tag) == "style" || string(tag) == "head") {
				skip--
			}
		case html.TextToken:
			if skip == 0 {
				output.Write(tokenizer.Text())
			}
		}
	}
}
