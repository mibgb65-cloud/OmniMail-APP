package mailproto

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"html"
	"strings"
	"time"

	"github.com/emersion/go-message/mail"

	"omnimail/internal/apperr"
)

type OutgoingAttachment struct {
	Filename string `json:"filename"`
	MimeType string `json:"mimeType,omitempty"`
	FilePath string `json:"filePath,omitempty"`
	Data     []byte `json:"-"`
}

type BuildMessageInput struct {
	FromName       string
	FromEmail      string
	ReplyTo        string
	To             []string
	Cc             []string
	Bcc            []string
	Subject        string
	BodyText       string
	BodyHTML       string
	CalendarICS    string
	CalendarMethod string
	InReplyTo      string
	References     []string
	ExtraHeaders   map[string]string
	Attachments    []OutgoingAttachment
}

type BuiltMessage struct {
	RFCMessageID       string
	FromEnvelope       string
	EnvelopeRecipients []string
	RawBytes           []byte
	ToAddrs            []EmailAddress
	CcAddrs            []EmailAddress
	BccAddrs           []EmailAddress
}

// BuildRFC5322 构造标准 MIME 邮件字节流；BCC 严格仅进入 SMTP 信封列表，绝不写入邮件头。
func BuildRFC5322(in BuildMessageInput) (*BuiltMessage, error) {
	fromAddr := strings.ToLower(strings.TrimSpace(in.FromEmail))
	if !strings.Contains(fromAddr, "@") {
		return nil, apperr.New(apperr.CodeInvalidInput, "发件人邮箱地址无效")
	}
	toList := parseRecipientStrings(in.To)
	ccList := parseRecipientStrings(in.Cc)
	bccList := parseRecipientStrings(in.Bcc)
	if len(toList)+len(ccList)+len(bccList) == 0 {
		return nil, apperr.New(apperr.CodeInvalidInput, "请至少填写一位有效收件人")
	}

	domain := fromAddr[strings.LastIndexByte(fromAddr, '@')+1:]
	rnd := make([]byte, 6)
	_, _ = rand.Read(rnd)
	cleanMsgID := fmt.Sprintf("omnimail.%d.%s@%s", time.Now().UnixMilli(), hex.EncodeToString(rnd), domain)

	h := buildMessageHeader(in, fromAddr, cleanMsgID, toList, ccList)
	var buf bytes.Buffer
	mw, err := mail.CreateWriter(&buf, h)
	if err != nil {
		return nil, err
	}
	if err := writeInlineBodyParts(mw, in); err != nil {
		return nil, err
	}
	if err := writeAttachmentParts(mw, in.Attachments); err != nil {
		return nil, err
	}
	if err := mw.Close(); err != nil {
		return nil, err
	}

	return &BuiltMessage{
		RFCMessageID:       cleanMsgID,
		FromEnvelope:       fromAddr,
		EnvelopeRecipients: mergeEnvelopeRecipients(toList, ccList, bccList),
		RawBytes:           buf.Bytes(),
		ToAddrs:            toEmailAddrSlice(toList),
		CcAddrs:            toEmailAddrSlice(ccList),
		BccAddrs:           toEmailAddrSlice(bccList),
	}, nil
}

func writeInlineBodyParts(mw *mail.Writer, in BuildMessageInput) error {
	iw, err := mw.CreateInline()
	if err != nil {
		return err
	}
	plainText := in.BodyText
	if strings.TrimSpace(plainText) == "" && in.BodyHTML != "" {
		plainText = StripHTMLToText(in.BodyHTML)
	}
	var th mail.InlineHeader
	th.SetContentType("text/plain", map[string]string{"charset": "utf-8"})
	tw, err := iw.CreatePart(th)
	if err != nil {
		return err
	}
	_, _ = tw.Write([]byte(plainText))
	_ = tw.Close()

	htmlText := in.BodyHTML
	if strings.TrimSpace(htmlText) == "" {
		escaped := html.EscapeString(plainText)
		htmlText = "<div style=\"font-family:system-ui,sans-serif;font-size:14px;line-height:1.6\">" +
			strings.ReplaceAll(strings.ReplaceAll(escaped, "\r\n", "\n"), "\n", "<br/>") + "</div>"
	}
	var hh mail.InlineHeader
	hh.SetContentType("text/html", map[string]string{"charset": "utf-8"})
	hw, err := iw.CreatePart(hh)
	if err != nil {
		return err
	}
	_, _ = hw.Write([]byte(htmlText))
	_ = hw.Close()

	if strings.TrimSpace(in.CalendarICS) != "" {
		method := strings.ToUpper(strings.TrimSpace(in.CalendarMethod))
		if method == "" {
			method = "REPLY"
		}
		var ch mail.InlineHeader
		ch.SetContentType("text/calendar", map[string]string{"charset": "utf-8", "method": method})
		if cw, cErr := iw.CreatePart(ch); cErr == nil {
			_, _ = cw.Write([]byte(in.CalendarICS))
			_ = cw.Close()
		}
	}
	return iw.Close()
}
