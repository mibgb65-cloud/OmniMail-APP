package mailproto

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/url"
	"strings"
	"time"

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
	InlineImages   []InlineImage
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
	if err := writeMimeBodyHierarchy(&buf, h, in); err != nil {
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

type InlineImage struct {
	AttachmentID string
	ContentID    string
	Filename     string
	MimeType     string
	Data         []byte
}

// rewriteInlineImageSources 将草稿中的 /omnimail-cid/{id} 替换为标准 cid:{contentId}，并仅返回实际被引用的内嵌图。
func rewriteInlineImageSources(bodyHTML string, images []InlineImage) (string, []InlineImage) {
	if strings.TrimSpace(bodyHTML) == "" || len(images) == 0 {
		return bodyHTML, nil
	}
	rewritten := bodyHTML
	used := make([]InlineImage, 0, len(images))
	seenCID := make(map[string]bool)
	for _, img := range images {
		if len(img.Data) == 0 {
			continue
		}
		cid := strings.Trim(strings.TrimSpace(img.ContentID), "<>")
		if cid == "" {
			continue
		}
		attID := strings.TrimSpace(img.AttachmentID)
		matched := false
		if attID != "" {
			rawRef := "/omnimail-cid/" + attID
			escRef := "/omnimail-cid/" + url.PathEscape(attID)
			if strings.Contains(rewritten, rawRef) {
				rewritten = strings.ReplaceAll(rewritten, rawRef, "cid:"+cid)
				matched = true
			}
			if escRef != rawRef && strings.Contains(rewritten, escRef) {
				rewritten = strings.ReplaceAll(rewritten, escRef, "cid:"+cid)
				matched = true
			}
		}
		if strings.Contains(rewritten, "cid:"+cid) {
			matched = true
		}
		if matched && !seenCID[cid] {
			seenCID[cid] = true
			cp := img
			cp.ContentID = cid
			used = append(used, cp)
		}
	}
	return rewritten, used
}
