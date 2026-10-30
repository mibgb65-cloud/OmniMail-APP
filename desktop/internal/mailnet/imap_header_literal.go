package mailnet

import (
	"bytes"
	"io"
	"mime"
	"net/mail"
	"strings"

	"omnimail/desktop/internal/domain"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"
	"github.com/emersion/go-message/charset"
)

const maxHeaderBytes = maxTextBytes

func (s *session) readHeaderLiteral(item imapclient.FetchItemDataBodySection) (*imap.Envelope, error) {
	section, literal := item.Section, item.Literal
	if section == nil || section.Specifier != imap.PartSpecifierHeader || len(section.Part) != 0 ||
		len(section.HeaderFields) != 0 || len(section.HeaderFieldsNot) != 0 || section.Partial != nil || literal == nil {
		return nil, &protocolFailure{reason: "unexpected_body"}
	}
	if literal.Size() < 0 {
		return nil, domain.ErrProtocol
	}
	if literal.Size() > maxHeaderBytes {
		return nil, domain.ErrTooLarge
	}
	reader := &literalFailureReader{source: literal, remaining: literal.Size()}
	data, err := io.ReadAll(io.LimitReader(reader, maxHeaderBytes+1))
	if reader.remaining != 0 {
		err = io.ErrUnexpectedEOF
	}
	if err != nil {
		return nil, s.commandError(err)
	}
	message, err := mail.ReadMessage(bytes.NewReader(data))
	if err != nil {
		return nil, domain.ErrProtocol
	}
	decoder := &mime.WordDecoder{CharsetReader: charset.Reader}
	subject, err := decoder.DecodeHeader(message.Header.Get("Subject"))
	if err != nil {
		subject = message.Header.Get("Subject")
	}
	// 头部仅用于摘要；原始响应不进入日志，展示字段继续经过长度与控制字符清理。
	return &imap.Envelope{
		Subject: subject, MessageID: strings.Trim(message.Header.Get("Message-ID"), "<>"),
		From: headerAddresses(message.Header.Get("From"), decoder),
		To:   headerAddresses(message.Header.Get("To"), decoder),
	}, nil
}

func headerAddresses(value string, decoder *mime.WordDecoder) []imap.Address {
	addresses, err := (&mail.AddressParser{WordDecoder: decoder}).ParseList(value)
	if err != nil {
		// 畸形地址不阻断摘要；缺少合法主机的项会在最终格式化时省略，不伪造可发信地址。
		return []imap.Address{{Mailbox: bounded(value, 4096)}}
	}
	result := make([]imap.Address, 0, min(len(addresses), 100))
	for _, address := range addresses[:min(len(addresses), 100)] {
		separator := strings.LastIndexByte(address.Address, '@')
		local, host := address.Address, ""
		if separator >= 0 {
			local, host = address.Address[:separator], address.Address[separator+1:]
		}
		result = append(result, imap.Address{Mailbox: local, Host: host})
	}
	return result
}
