package domain

// 收信大小策略的唯一代码来源；邮件头、图片和发送预算独立，不能跟随正文上限一起放宽。
const (
	MaxRawMessageBytes  = 100 << 20
	MaxAttachmentBytes  = 50 << 20
	MaxMessageTextBytes = 8 << 20
	MaxMailHeaderBytes  = 1 << 20
	MaxMessageParts     = 128
)

type messageLimitError string

func (e messageLimitError) Error() string { return string(e) }
func (e messageLimitError) Unwrap() error { return ErrTooLarge }

var (
	ErrRawMessageTooLarge  error = messageLimitError("MESSAGE_RAW_TOO_LARGE")
	ErrAttachmentTooLarge  error = messageLimitError("ATTACHMENT_TOO_LARGE")
	ErrMessageTextTooLarge error = messageLimitError("MESSAGE_TEXT_TOO_LARGE")
	ErrTooManyMailParts    error = messageLimitError("MESSAGE_PARTS_TOO_MANY")
)

// MessageLimitCode 只接受确定属于单封的大小错误，不把连接预算或存储异常误记为永久受限。
func MessageLimitCode(err error) string {
	if limit, ok := err.(messageLimitError); ok {
		return limit.Error()
	}
	if joined, ok := err.(interface{ Unwrap() []error }); ok {
		code := ""
		for _, cause := range joined.Unwrap() {
			current := MessageLimitCode(cause)
			// 混合错误可能包含磁盘清理/存储失败，不能因其中一个限额原因就永久排除该邮件。
			if current == "" || (code != "" && code != current) {
				return ""
			}
			code = current
		}
		return code
	}
	if wrapped, ok := err.(interface{ Unwrap() error }); ok {
		return MessageLimitCode(wrapped.Unwrap())
	}
	return ""
}
