package apperr

import (
	"errors"
	"fmt"
	"strings"
)

const (
	CodePinRequired        = "ERR_PIN_REQUIRED"
	CodePinInvalid         = "ERR_PIN_INVALID"
	CodeAuthExpired        = "ERR_AUTH_EXPIRED"
	CodeIdentityLocked     = "ERR_IDENTITY_LOCKED"
	CodeUndoWindowExpired  = "ERR_UNDO_WINDOW_EXPIRED"
	CodeAiDisabled         = "ERR_AI_DISABLED"
	CodeAiConsentRequired  = "ERR_AI_CONSENT_REQUIRED"
	CodeAiSensitiveBlocked = "ERR_AI_SENSITIVE_BLOCKED"
	CodeTranslationFailed  = "ERR_TRANSLATION_FAILED"
	CodeNetworkOffline     = "ERR_NETWORK_OFFLINE"
	CodeDiskFull           = "ERR_DISK_FULL"
	CodeInvalidInput       = "ERR_INVALID_INPUT"
	CodeNotFound           = "ERR_NOT_FOUND"
	CodeConnFailed         = "ERR_CONN_FAILED"
	CodeCertUntrusted      = "ERR_CERT_UNTRUSTED"
	CodeInternal           = "ERR_INTERNAL"

	CodeMuseNotLoggedIn     = "ERR_MUSE_NOT_LOGGED_IN"
	CodeMuseAuthExpired     = "ERR_MUSE_AUTH_EXPIRED"
	CodeMuseNotEnabled      = "ERR_MUSE_NOT_ENABLED"
	CodeMuseIdentityChanged = "ERR_MUSE_IDENTITY_CHANGED"
	CodeMuseGatewayTimeout  = "ERR_MUSE_GATEWAY_TIMEOUT"
	CodeMuseGatewayFailed   = "ERR_MUSE_GATEWAY_FAILED"
	CodeMuseUnsupported     = "ERR_MUSE_UNSUPPORTED"
	CodeMuseCancelled       = "ERR_MUSE_CANCELLED"

	CodeWBAuthRequired       = "ERR_WB_AUTH_REQUIRED"
	CodeWBAuthTimeout        = "ERR_WB_AUTH_TIMEOUT"
	CodeWBNotBound           = "ERR_WB_NOT_BOUND"
	CodeWBSuspended          = "ERR_WB_SUSPENDED"
	CodeWBQuotaExceeded      = "ERR_WB_QUOTA_EXCEEDED"
	CodeWBRateLimited        = "ERR_WB_RATE_LIMITED"
	CodeWBAttachmentTooLarge = "ERR_WB_ATTACHMENT_TOO_LARGE"
	CodeWBGatewayFailed      = "ERR_WB_GATEWAY_FAILED"
	CodeWBCancelled          = "ERR_WB_CANCELLED"
)

// AppError 统一格式化为 "[ERR_CODE] 中文人类可读提示"，方便前端精准识别错误码。
type AppError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Cause   error  `json:"-"`
}

func (e *AppError) Error() string {
	if e.Code == "" {
		return e.Message
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

func (e *AppError) Unwrap() error {
	return e.Cause
}

func New(code, message string) error {
	return &AppError{Code: code, Message: message}
}

func Wrap(code, message string, cause error) error {
	return &AppError{Code: code, Message: message, Cause: cause}
}

func CodeOf(err error) string {
	if err == nil {
		return ""
	}
	var ae *AppError
	if errors.As(err, &ae) {
		return ae.Code
	}
	msg := err.Error()
	if strings.HasPrefix(msg, "[ERR_") {
		if idx := strings.IndexByte(msg, ']'); idx > 1 {
			return msg[1:idx]
		}
	}
	return ""
}
