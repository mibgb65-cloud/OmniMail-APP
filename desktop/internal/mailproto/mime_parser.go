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
	rawHdr := ExtractRawHeaderBlock(raw)
	hint := DetectHeaderCharsetHint(rawHdr)
	out := &ParsedEmail{
		RawHeaders: EnsureUTF8HeaderBytes(rawHdr, hint),
		SentAt:     time.Now(),
	}
	mr, err := mail.CreateReader(bytes.NewReader(raw))
	if err != nil && !message.IsUnknownCharset(err) {
		// 极端非标准邮件头降级为纯文本读取，仍尽可能从原始头块恢复主题与发/收件人
		parseEnvelopeHeaders(nil, rawHdr, hint, out)
		out.BodyText = EnsureUTF8HeaderBytes(strings.TrimSpace(extractFallbackBody(raw)), hint)
		return out, nil
	}
	parseEnvelopeHeaders(&mr.Header, rawHdr, hint, out)

	partIndex := 0
	for {
		p, partErr := mr.NextPart()
		if errors.Is(partErr, io.EOF) || (partErr != nil && !message.IsUnknownCharset(partErr)) {
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

func parseEnvelopeHeaders(h *mail.Header, rawHdr, hint string, out *ParsedEmail) {
	if h != nil {
		if id, err := h.MessageID(); err == nil {
			out.RFCMessageID = EnsureUTF8HeaderBytes(strings.TrimSpace(id), hint)
		}
		if dt, err := h.Date(); err == nil && !dt.IsZero() {
			out.SentAt = dt
		}
		if refs, err := h.MsgIDList("References"); err == nil {
			out.References = refs
		}
		if irt, err := h.MsgIDList("In-Reply-To"); err == nil && len(irt) > 0 {
			out.InReplyTo = EnsureUTF8HeaderBytes(irt[0], hint)
		}
	}
	sub, sender, replyTo, to, cc := ParseHeaderBlockEnvelope(rawHdr)
	if sub == "" && h != nil {
		if s, err := h.Subject(); err == nil && strings.TrimSpace(s) != "" {
			sub = EnsureUTF8HeaderBytes(strings.TrimSpace(s), hint)
		} else {
			sub = strings.TrimSpace(DecodeHeaderTextWithHint(h.Get("Subject"), hint))
		}
	}
	if sub == "" {
		sub = "（无主题）"
	}
	out.Subject = sub
	if sender.Email == "" && sender.Name == "" && h != nil {
		if list := readAddressList(h, "From", hint); len(list) > 0 {
			sender = list[0]
		}
	}
	out.Sender = sender
	out.ReplyTo = fallbackAddrList(replyTo, h, "Reply-To", hint)
	out.To = fallbackAddrList(to, h, "To", hint)
	out.Cc = fallbackAddrList(cc, h, "Cc", hint)
}

func fallbackAddrList(cur []EmailAddress, h *mail.Header, key, hint string) []EmailAddress {
	if len(cur) > 0 || h == nil {
		return cur
	}
	return readAddressList(h, key, hint)
}

func readAddressList(h *mail.Header, key, hint string) []EmailAddress {
	if raw := h.Get(key); strings.TrimSpace(raw) != "" {
		if parsed := ParseAddressHeader(raw, hint); len(parsed) > 0 {
			return parsed
		}
	}
	list, err := h.AddressList(key)
	if err != nil || len(list) == 0 {
		return nil
	}
	out := make([]EmailAddress, 0, len(list))
	for _, a := range list {
		out = append(out, finalizeEmailAddress(cleanDisplayName(a.Name, hint), cleanEmailAddr(a.Address)))
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
			preview = string(data[:min(len(data), 2048)])
		}
		out.Attachments = append(out.Attachments, ParsedAttachment{
			PartID: strconv.Itoa(idx), Filename: fn, Ext: ext, MimeType: ctLower,
			ContentID: cid, IsInline: false, Kind: kind, PreviewText: preview, Data: data,
		})
	}
}
