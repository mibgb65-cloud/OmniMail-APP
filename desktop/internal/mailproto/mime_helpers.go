package mailproto

import (
	"bytes"
	"errors"
	"html"
	"io"
	"mime"
	"path/filepath"
	"regexp"
	"strings"
	"unicode"

	"github.com/emersion/go-message"
	"github.com/emersion/go-message/mail"
)

var (
	reHTMLStyleScript = regexp.MustCompile(`(?is)<(script|style)\b[^>]*>.*?</(script|style)>`)
	reHTMLTags        = regexp.MustCompile(`(?s)<[^>]+>`)
	reMultiSpace      = regexp.MustCompile(`\s+`)
)

// SanitizeFilename 解码 RFC2047 并清除路径穿越与 Windows 非法字符。
func SanitizeFilename(raw string) string {
	decoded := DecodeHeaderText(strings.TrimSpace(raw))
	decoded = strings.ReplaceAll(decoded, "\\", "/")
	if idx := strings.LastIndexByte(decoded, '/'); idx >= 0 {
		decoded = decoded[idx+1:]
	}
	var b strings.Builder
	for _, r := range decoded {
		if unicode.IsControl(r) {
			continue
		}
		switch r {
		case '<', '>', ':', '"', '/', '\\', '|', '?', '*':
			b.WriteByte('_')
		default:
			b.WriteRune(r)
		}
	}
	clean := strings.Trim(b.String(), " .")
	if clean == "" {
		return "attachment.bin"
	}
	runes := []rune(clean)
	if len(runes) > 120 {
		ext := filepath.Ext(clean)
		clean = string(runes[:100]) + ext
	}
	return clean
}

func ClassifyAttachmentKind(filename, mimeType string) (ext string, kind string) {
	rawExt := strings.TrimPrefix(strings.ToLower(filepath.Ext(filename)), ".")
	mt := strings.ToLower(strings.TrimSpace(mimeType))
	switch {
	case rawExt == "pdf" || strings.Contains(mt, "application/pdf"):
		return "pdf", "pdf"
	case rawExt == "ics" || strings.Contains(mt, "text/calendar"):
		return "ics", "ics"
	case rawExt == "png" || rawExt == "jpg" || rawExt == "jpeg" || rawExt == "gif" || rawExt == "webp" || rawExt == "svg" || strings.HasPrefix(mt, "image/"):
		if rawExt == "" {
			rawExt = "png"
		}
		return rawExt, "image"
	case rawExt == "zip" || rawExt == "7z" || rawExt == "rar" || rawExt == "tar" || rawExt == "gz" || strings.Contains(mt, "zip"):
		if rawExt == "" {
			rawExt = "zip"
		}
		return rawExt, "zip"
	default:
		if rawExt == "" {
			rawExt = "bin"
		}
		return rawExt, "other"
	}
}

func StripHTMLToText(htmlBody string) string {
	if strings.TrimSpace(htmlBody) == "" {
		return ""
	}
	s := reHTMLStyleScript.ReplaceAllString(htmlBody, " ")
	s = strings.ReplaceAll(s, "<br>", "\n")
	s = strings.ReplaceAll(s, "<br/>", "\n")
	s = strings.ReplaceAll(s, "</p>", "\n")
	s = strings.ReplaceAll(s, "</div>", "\n")
	s = reHTMLTags.ReplaceAllString(s, " ")
	s = html.UnescapeString(s)
	return strings.TrimSpace(s)
}

func MakeSnippet(bodyText, bodyHTML string, maxRunes int) string {
	src := strings.TrimSpace(bodyText)
	if src == "" {
		src = StripHTMLToText(bodyHTML)
	}
	flat := strings.TrimSpace(reMultiSpace.ReplaceAllString(src, " "))
	runes := []rune(flat)
	if len(runes) <= maxRunes {
		return flat
	}
	return string(runes[:maxRunes]) + "…"
}

func ExtractRawHeaderBlock(raw []byte) string {
	if idx := bytes.Index(raw, []byte("\r\n\r\n")); idx >= 0 {
		return string(raw[:idx])
	}
	if idx := bytes.Index(raw, []byte("\n\n")); idx >= 0 {
		return string(raw[:idx])
	}
	if len(raw) > 8192 {
		return string(raw[:8192])
	}
	return string(raw)
}

func extractFallbackBody(raw []byte) string {
	if idx := bytes.Index(raw, []byte("\r\n\r\n")); idx >= 0 {
		return string(raw[idx+4:])
	}
	if idx := bytes.Index(raw, []byte("\n\n")); idx >= 0 {
		return string(raw[idx+2:])
	}
	return string(raw)
}

// ExtractRawBodyHTML 仅流式读取原始 EML 中的内联 text/html 正文，跳过二进制附件（供存量样式修复使用）。
func ExtractRawBodyHTML(raw []byte) string {
	mr, err := mail.CreateReader(bytes.NewReader(raw))
	if err != nil && !message.IsUnknownCharset(err) {
		return ""
	}
	var out strings.Builder
	for {
		p, partErr := mr.NextPart()
		if errors.Is(partErr, io.EOF) || (partErr != nil && !message.IsUnknownCharset(partErr)) {
			break
		}
		if p == nil {
			continue
		}
		if _, ok := p.Header.(*mail.InlineHeader); !ok {
			continue
		}
		ct, _, _ := mime.ParseMediaType(p.Header.Get("Content-Type"))
		cid := strings.Trim(strings.TrimSpace(p.Header.Get("Content-ID")), "<>")
		if strings.EqualFold(strings.TrimSpace(ct), "text/html") && cid == "" {
			data, _ := io.ReadAll(io.LimitReader(p.Body, 16*1024*1024))
			out.Write(data)
		}
	}
	return out.String()
}
