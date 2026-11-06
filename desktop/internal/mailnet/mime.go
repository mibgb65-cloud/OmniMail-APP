package mailnet

import (
	"errors"
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
	maxRawBytes  = domain.MaxRawMessageBytes
	maxPartBytes = domain.MaxAttachmentBytes
	maxTextBytes = domain.MaxMessageTextBytes
)

// 这里保留一个有界解码循环，统一累计纯文本与 HTML 回退预算并立即调用流式 sink；
// 不把共享预算拆成互不知情的处理器，避免 multipart/alternative 绕过总大小限制。
func decodeReader(source io.Reader, size int64, sink domain.AttachmentSink) (domain.DecodedMail, error) {
	result := domain.DecodedMail{Attachments: []domain.DecodedAttachment{}}
	if size > maxRawBytes {
		return result, domain.ErrRawMessageTooLarge
	}
	input := &mimeBoundaryReader{source: io.LimitReader(source, maxRawBytes+1)}
	reader, err := mail.CreateReader(input)
	if err != nil {
		return result, mimeDecodeFailure("mime_header_invalid", err)
	}
	kind, params, typeError := reader.Header.ContentType()
	if typeError == nil && strings.HasPrefix(kind, "multipart/") {
		if err := input.setBoundary(params["boundary"]); err != nil {
			return result, err
		}
	}
	textBytes := 0
	parts := 0
	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			return result, mimeDecodeFailure("mime_part_invalid", err)
		}
		parts++
		if parts > domain.MaxMessageParts {
			return result, domain.ErrTooManyMailParts
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
					if errors.Is(err, io.ErrUnexpectedEOF) {
						switch strings.ToLower(strings.TrimSpace(part.Header.Get("Content-Transfer-Encoding"))) {
						case "base64":
							return result, &protocolFailure{reason: "mime_base64_truncated"}
						case "quoted-printable":
							return result, &protocolFailure{reason: "mime_quoted_printable_truncated"}
						}
					}
					return result, mimeDecodeFailure("mime_text_read_failed", err)
				}
				text := strings.ToValidUTF8(string(data), "\uFFFD")
				textBytes += len(text)
				if textBytes > maxTextBytes {
					return result, domain.ErrMessageTextTooLarge
				}
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
	if input.appended && parts == 0 {
		return result, &protocolFailure{reason: "mime_part_invalid"}
	}
	if result.Text == "" {
		fallback := htmlText(result.HTML)
		// 原始 HTML 不截断；空间不足时不额外持久化派生纯文本副本，避免同一内容被重复计入 8 MiB。
		if len(fallback)+len(result.HTML) <= maxTextBytes {
			result.Text = fallback
		}
	}
	return result, nil
}

func decodeAttachment(name, kind string, reader io.Reader, sink domain.AttachmentSink) (domain.DecodedAttachment, error) {
	if sink != nil {
		limited := &io.LimitedReader{R: reader, N: maxPartBytes + 1}
		attachment, err := sink(name, kind, limited)
		if err != nil {
			return attachment, err
		}
		if limited.N == 0 || attachment.Size > maxPartBytes || len(attachment.Data) > maxPartBytes {
			return attachment, domain.ErrAttachmentTooLarge
		}
		return attachment, nil
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
