package mailproto

import (
	"mime"
	stdmail "net/mail"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/emersion/go-message/mail"

	"omnimail/internal/apperr"
)

func buildMessageHeader(in BuildMessageInput, fromAddr, cleanMsgID string, toList, ccList []*mail.Address) mail.Header {
	var h mail.Header
	h.SetDate(time.Now())
	h.SetMessageID(cleanMsgID)
	h.SetAddressList("From", []*mail.Address{{Name: strings.TrimSpace(in.FromName), Address: fromAddr}})
	if rt := strings.TrimSpace(in.ReplyTo); rt != "" && strings.Contains(rt, "@") {
		h.SetAddressList("Reply-To", parseRecipientStrings([]string{rt}))
	}
	if len(toList) > 0 {
		h.SetAddressList("To", toList)
	}
	if len(ccList) > 0 {
		h.SetAddressList("Cc", ccList)
	}
	// 注意：严禁调用 h.SetAddressList("Bcc", ...)，保障密送隐私安全！
	sub := strings.TrimSpace(in.Subject)
	if sub == "" {
		sub = "（无主题）"
	}
	h.SetSubject(sub)
	if irt := strings.Trim(strings.TrimSpace(in.InReplyTo), "<>"); irt != "" {
		h.SetMsgIDList("In-Reply-To", []string{irt})
	}
	if len(in.References) > 0 {
		cleanRefs := make([]string, 0, len(in.References))
		for _, r := range in.References {
			if cr := strings.Trim(strings.TrimSpace(r), "<>"); cr != "" {
				cleanRefs = append(cleanRefs, cr)
			}
		}
		if len(cleanRefs) > 0 {
			h.SetMsgIDList("References", cleanRefs)
		}
	}
	h.Set("X-Mailer", "OmniMail Desktop")
	for k, v := range in.ExtraHeaders {
		if strings.TrimSpace(k) != "" && strings.TrimSpace(v) != "" {
			h.Set(k, v)
		}
	}
	return h
}

func writeAttachmentParts(mw *mail.Writer, attachments []OutgoingAttachment) error {
	var totalAttBytes int64
	for _, att := range attachments {
		data := att.Data
		if len(data) == 0 && strings.TrimSpace(att.FilePath) != "" {
			loaded, readErr := os.ReadFile(filepath.Clean(att.FilePath))
			if readErr != nil {
				return apperr.New(apperr.CodeInvalidInput, "无法读取本地附件文件: "+filepath.Base(att.FilePath))
			}
			data = loaded
		}
		totalAttBytes += int64(len(data))
		if totalAttBytes > 50*1024*1024 {
			return apperr.New(apperr.CodeInvalidInput, "单封邮件附件总大小超过 50 MB 上限")
		}
		fn := SanitizeFilename(att.Filename)
		if fn == "attachment.bin" && att.FilePath != "" {
			fn = SanitizeFilename(filepath.Base(att.FilePath))
		}
		mt := strings.TrimSpace(att.MimeType)
		if mt == "" {
			mt = mime.TypeByExtension(strings.ToLower(filepath.Ext(fn)))
		}
		if mt == "" {
			mt = "application/octet-stream"
		}
		var ah mail.AttachmentHeader
		ah.SetContentType(mt, nil)
		ah.SetFilename(fn)
		aw, aErr := mw.CreateAttachment(ah)
		if aErr != nil {
			return aErr
		}
		_, _ = aw.Write(data)
		_ = aw.Close()
	}
	return nil
}

func mergeEnvelopeRecipients(lists ...[]*mail.Address) []string {
	rcptMap := make(map[string]bool)
	var rcpts []string
	for _, list := range lists {
		for _, a := range list {
			addr := strings.ToLower(strings.TrimSpace(a.Address))
			if addr != "" && !rcptMap[addr] {
				rcptMap[addr] = true
				rcpts = append(rcpts, addr)
			}
		}
	}
	return rcpts
}

func parseRecipientStrings(items []string) []*mail.Address {
	var out []*mail.Address
	for _, raw := range items {
		for _, seg := range strings.Split(raw, ",") {
			s := strings.TrimSpace(seg)
			if s == "" {
				continue
			}
			if parsed, err := stdmail.ParseAddress(s); err == nil && strings.Contains(parsed.Address, "@") {
				out = append(out, &mail.Address{Name: parsed.Name, Address: strings.ToLower(parsed.Address)})
			} else if strings.Contains(s, "@") {
				out = append(out, &mail.Address{Address: strings.ToLower(s)})
			}
		}
	}
	return out
}

func toEmailAddrSlice(in []*mail.Address) []EmailAddress {
	out := make([]EmailAddress, 0, len(in))
	for _, a := range in {
		out = append(out, EmailAddress{Name: a.Name, Email: a.Address})
	}
	return out
}
