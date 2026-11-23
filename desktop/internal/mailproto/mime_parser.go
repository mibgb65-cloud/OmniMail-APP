package mailproto

import (
	"bytes"
	"errors"
	"io"
	"mime"
	"strconv"
	"strings"
	"time"

	"github.com/emersion/go-message"
	"github.com/emersion/go-message/mail"
)

type EmailAddress struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

type ParsedAttachment struct {
	PartID      string
	Filename    string
	Ext         string
	MimeType    string
	ContentID   string
	IsInline    bool
	Kind        string
	PreviewText string
	Data        []byte
}

type ParsedEmail struct {
	RFCMessageID string
	InReplyTo    string
	References   []string
	Subject      string
	Sender       EmailAddress
	ReplyTo      []EmailAddress
	To           []EmailAddress
	Cc           []EmailAddress
	SentAt       time.Time
	RawHeaders   string
	BodyText     string
	BodyHTML     string
	Attachments  []ParsedAttachment
	RawICS       string
	ICSFilename  string
}

func ParseRawMessage(raw []byte) (*ParsedEmail, error) {
	out := &ParsedEmail{
		RawHeaders: ExtractRawHeaderBlock(raw),
		SentAt:     time.Now(),
	}
	mr, err := mail.CreateReader(bytes.NewReader(raw))
	if err != nil && !message.IsUnknownCharset(err) {
		// 极端非标准邮件头降级为纯文本读取，绝不因一封畸形头中断整箱同步
		out.BodyText = strings.TrimSpace(extractFallbackBody(raw))
		return out, nil
	}
	parseEnvelopeHeaders(&mr.Header, out)

	partIndex := 0
	for {
		p, partErr := mr.NextPart()
		if errors.Is(partErr, io.EOF) {
			break
		}
		if partErr != nil && !message.IsUnknownCharset(partErr) {
			break
		}
		if p == nil {
			continue
		}
		partIndex++
		consumePart(p, partIndex, out)
	}
	if out.BodyText == "" && out.BodyHTML != "" {
		out.BodyText = StripHTMLToText(out.BodyHTML)
	}
	return out, nil
}

func parseEnvelopeHeaders(h *mail.Header, out *ParsedEmail) {
	if id, err := h.MessageID(); err == nil {
		out.RFCMessageID = strings.TrimSpace(id)
	}
	if sub, err := h.Subject(); err == nil && strings.TrimSpace(sub) != "" {
		out.Subject = strings.TrimSpace(sub)
	} else {
		out.Subject = strings.TrimSpace(DecodeHeaderText(h.Get("Subject")))
	}
	if out.Subject == "" {
		out.Subject = "（无主题）"
	}
	if dt, err := h.Date(); err == nil && !dt.IsZero() {
		out.SentAt = dt
	}
	if refs, err := h.MsgIDList("References"); err == nil {
		out.References = refs
	}
	if irt, err := h.MsgIDList("In-Reply-To"); err == nil && len(irt) > 0 {
		out.InReplyTo = irt[0]
	}
	froms := readAddressList(h, "From")
	if len(froms) > 0 {
		out.Sender = froms[0]
	}
	out.ReplyTo = readAddressList(h, "Reply-To")
	out.To = readAddressList(h, "To")
	out.Cc = readAddressList(h, "Cc")
}

func readAddressList(h *mail.Header, key string) []EmailAddress {
	list, err := h.AddressList(key)
	if err != nil || len(list) == 0 {
		raw := strings.TrimSpace(DecodeHeaderText(h.Get(key)))
		if raw == "" {
			return nil
		}
		return []EmailAddress{{Name: raw, Email: raw}}
	}
	out := make([]EmailAddress, 0, len(list))
	for _, a := range list {
		name := DecodeHeaderText(strings.TrimSpace(a.Name))
		addr := strings.ToLower(strings.TrimSpace(a.Address))
		if name == "" && addr != "" {
			if at := strings.IndexByte(addr, '@'); at > 0 {
				name = addr[:at]
			} else {
				name = addr
			}
		}
		out = append(out, EmailAddress{Name: name, Email: addr})
	}
	return out
}

func consumePart(p *mail.Part, idx int, out *ParsedEmail) {
	data, _ := io.ReadAll(io.LimitReader(p.Body, 64*1024*1024))
	ct, _, _ := mime.ParseMediaType(p.Header.Get("Content-Type"))
	ctLower := strings.ToLower(strings.TrimSpace(ct))
	cid := strings.Trim(strings.TrimSpace(p.Header.Get("Content-ID")), "<>")

	switch hdr := p.Header.(type) {
	case *mail.InlineHeader:
		switch {
		case ctLower == "text/plain" && cid == "":
			if out.BodyText != "" {
				out.BodyText += "\n"
			}
			out.BodyText += string(data)
		case ctLower == "text/html" && cid == "":
			out.BodyHTML += string(data)
		case ctLower == "text/calendar":
			if out.RawICS == "" {
				out.RawICS = string(data)
				out.ICSFilename = "invite.ics"
			}
		case cid != "" || strings.HasPrefix(ctLower, "image/"):
			_, params, _ := hdr.ContentDisposition()
			fn := SanitizeFilename(params["filename"])
			ext, kind := ClassifyAttachmentKind(fn, ctLower)
			out.Attachments = append(out.Attachments, ParsedAttachment{
				PartID: strconv.Itoa(idx), Filename: fn, Ext: ext,
				MimeType: ctLower, ContentID: cid, IsInline: true, Kind: kind, Data: data,
			})
		}
	case *mail.AttachmentHeader:
		rawName, _ := hdr.Filename()
		if rawName == "" {
			rawName = "attachment"
		}
		fn := SanitizeFilename(rawName)
		ext, kind := ClassifyAttachmentKind(fn, ctLower)
		if kind == "ics" && out.RawICS == "" {
			out.RawICS = string(data)
			out.ICSFilename = fn
		}
		preview := ""
		if strings.HasPrefix(ctLower, "text/") || ext == "txt" || ext == "csv" || ext == "md" || ext == "json" {
			limit := len(data)
			if limit > 2048 {
				limit = 2048
			}
			preview = string(data[:limit])
		}
		out.Attachments = append(out.Attachments, ParsedAttachment{
			PartID: strconv.Itoa(idx), Filename: fn, Ext: ext, MimeType: ctLower,
			ContentID: cid, IsInline: false, Kind: kind, PreviewText: preview, Data: data,
		})
	}
}
