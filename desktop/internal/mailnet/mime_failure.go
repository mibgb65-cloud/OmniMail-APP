package mailnet

import (
	"encoding/base64"
	"errors"
	"io"
	"strings"

	"github.com/emersion/go-message"
)

func mimeDecodeFailure(stage string, err error) error {
	reason := stage
	switch {
	case message.IsUnknownCharset(err):
		reason = "mime_charset_unknown"
	case message.IsUnknownEncoding(err):
		reason = "mime_encoding_unknown"
	case errors.As(err, new(base64.CorruptInputError)):
		reason = "mime_base64_invalid"
	case errors.Is(err, io.ErrUnexpectedEOF):
		reason = "mime_body_truncated"
	case err != nil && strings.HasPrefix(err.Error(), "quotedprintable:"):
		// 标准库该错误含原始字节，只匹配固定来源前缀，绝不将文本带入诊断。
		reason = "mime_quoted_printable_invalid"
	}
	// 标准错误只用于分类，绝不保留可能包含头字段/邮件内容的原始错误链。
	return &protocolFailure{reason: reason}
}
