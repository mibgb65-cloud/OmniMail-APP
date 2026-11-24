package mailproto

import (
	"bytes"
	"mime"
	"path/filepath"
	"strings"

	"github.com/emersion/go-message"
	"github.com/emersion/go-message/mail"
)

// writeMimeBodyHierarchy 按需拼装标准 MIME 层次：
// 纯文本 → text/plain；富文本 → multipart/alternative；带内嵌图 → multipart/related；混普通附件 → 最外层 multipart/mixed。
func writeMimeBodyHierarchy(buf *bytes.Buffer, baseHdr mail.Header, in BuildMessageInput) error {
	rewrittenHTML, usedInline := rewriteInlineImageSources(in.BodyHTML, in.InlineImages)
	hasHTML := strings.TrimSpace(rewrittenHTML) != ""
	hasCal := strings.TrimSpace(in.CalendarICS) != ""
	hasAlt := hasHTML || hasCal
	hasRelated := len(usedInline) > 0 && hasHTML
	hasMixed := len(in.Attachments) > 0

	plainText := in.BodyText
	if strings.TrimSpace(plainText) == "" && hasHTML {
		plainText = StripHTMLToText(rewrittenHTML)
	}

	rootHdr := baseHdr.Header.Copy()
	switch {
	case hasMixed:
		rootHdr.SetContentType("multipart/mixed", nil)
		root, err := message.CreateWriter(buf, rootHdr)
		if err != nil {
			return err
		}
		if err := writeContentPart(root, plainText, rewrittenHTML, in.CalendarICS, in.CalendarMethod, hasAlt, hasRelated, usedInline); err != nil {
			return err
		}
		if err := writeRawAttachmentParts(root, in.Attachments); err != nil {
			return err
		}
		return root.Close()
	case hasRelated:
		rootHdr.SetContentType("multipart/related", map[string]string{"type": "multipart/alternative"})
		root, err := message.CreateWriter(buf, rootHdr)
		if err != nil {
			return err
		}
		if err := writeAlternativeChild(root, plainText, rewrittenHTML, in.CalendarICS, in.CalendarMethod); err != nil {
			return err
		}
		if err := writeInlineImageParts(root, usedInline); err != nil {
			return err
		}
		return root.Close()
	case hasAlt:
		rootHdr.SetContentType("multipart/alternative", nil)
		root, err := message.CreateWriter(buf, rootHdr)
		if err != nil {
			return err
		}
		if err := writeAlternativeLeafParts(root, plainText, rewrittenHTML, in.CalendarICS, in.CalendarMethod); err != nil {
			return err
		}
		return root.Close()
	default:
		rootHdr.SetContentType("text/plain", map[string]string{"charset": "utf-8"})
		rootHdr.Set("Content-Transfer-Encoding", "quoted-printable")
		w, err := message.CreateWriter(buf, rootHdr)
		if err != nil {
			return err
		}
		if _, err := w.Write([]byte(plainText)); err != nil {
			return err
		}
		return w.Close()
	}
}

func writeContentPart(parent *message.Writer, plainText, htmlText, calICS, calMethod string, hasAlt, hasRelated bool, inline []InlineImage) error {
	switch {
	case hasRelated:
		var rh message.Header
		rh.SetContentType("multipart/related", map[string]string{"type": "multipart/alternative"})
		rw, err := parent.CreatePart(rh)
		if err != nil {
			return err
		}
		if err := writeAlternativeChild(rw, plainText, htmlText, calICS, calMethod); err != nil {
			return err
		}
		if err := writeInlineImageParts(rw, inline); err != nil {
			return err
		}
		return rw.Close()
	case hasAlt:
		return writeAlternativeChild(parent, plainText, htmlText, calICS, calMethod)
	default:
		return writeTextLeaf(parent, "text/plain", map[string]string{"charset": "utf-8"}, plainText)
	}
}

func writeAlternativeChild(parent *message.Writer, plainText, htmlText, calICS, calMethod string) error {
	var ah message.Header
	ah.SetContentType("multipart/alternative", nil)
	aw, err := parent.CreatePart(ah)
	if err != nil {
		return err
	}
	if err := writeAlternativeLeafParts(aw, plainText, htmlText, calICS, calMethod); err != nil {
		return err
	}
	return aw.Close()
}

func writeAlternativeLeafParts(aw *message.Writer, plainText, htmlText, calICS, calMethod string) error {
	if err := writeTextLeaf(aw, "text/plain", map[string]string{"charset": "utf-8"}, plainText); err != nil {
		return err
	}
	if strings.TrimSpace(htmlText) != "" {
		if err := writeTextLeaf(aw, "text/html", map[string]string{"charset": "utf-8"}, htmlText); err != nil {
			return err
		}
	}
	if strings.TrimSpace(calICS) != "" {
		method := strings.ToUpper(strings.TrimSpace(calMethod))
		if method == "" {
			method = "REPLY"
		}
		if err := writeTextLeaf(aw, "text/calendar", map[string]string{"charset": "utf-8", "method": method}, calICS); err != nil {
			return err
		}
	}
	return nil
}

func writeTextLeaf(parent *message.Writer, mediaType string, params map[string]string, body string) error {
	var h message.Header
	h.SetContentType(mediaType, params)
	h.Set("Content-Transfer-Encoding", "quoted-printable")
	pw, err := parent.CreatePart(h)
	if err != nil {
		return err
	}
	if _, err := pw.Write([]byte(body)); err != nil {
		return err
	}
	return pw.Close()
}

func writeInlineImageParts(parent *message.Writer, images []InlineImage) error {
	for _, img := range images {
		fn := SanitizeFilename(img.Filename)
		mt := strings.TrimSpace(img.MimeType)
		if mt == "" {
			mt = mime.TypeByExtension(strings.ToLower(filepath.Ext(fn)))
		}
		if mt == "" {
			mt = "image/png"
		}
		var h message.Header
		h.SetContentType(mt, map[string]string{"name": fn})
		h.SetContentDisposition("inline", map[string]string{"filename": fn})
		h.Set("Content-ID", "<"+img.ContentID+">")
		h.Set("Content-Transfer-Encoding", "base64")
		pw, err := parent.CreatePart(h)
		if err != nil {
			return err
		}
		if _, err := pw.Write(img.Data); err != nil {
			return err
		}
		if err := pw.Close(); err != nil {
			return err
		}
	}
	return nil
}
