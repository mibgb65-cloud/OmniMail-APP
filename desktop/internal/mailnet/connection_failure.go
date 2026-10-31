package mailnet

import (
	"context"
	"crypto/tls"
	"errors"
	"io"
	"net"
	"net/textproto"

	"github.com/emersion/go-imap/v2"
)

type connectionFailure struct {
	code   error
	stage  string
	reason string
}

func (e *connectionFailure) Error() string           { return e.code.Error() }
func (e *connectionFailure) Unwrap() error           { return e.code }
func (e *connectionFailure) ConnectionStage() string { return e.stage }
func (e *connectionFailure) DiagnosticCode() string  { return e.reason }

func connectionStepError(stage string, code, cause error) error {
	// 只保留稳定错误和白名单原因，不把可能包含用户名、IP 或服务器文本的 cause 放入错误链。
	return &connectionFailure{code: code, stage: stage, reason: connectionFailureReason(cause)}
}

func connectionFailureReason(err error) string {
	switch {
	case errors.Is(err, context.Canceled):
		return "canceled"
	case errors.Is(err, context.DeadlineExceeded):
		return "timeout"
	case errors.Is(err, io.EOF), errors.Is(err, io.ErrUnexpectedEOF),
		errors.Is(err, net.ErrClosed), errors.Is(err, io.ErrClosedPipe):
		return "server_closed"
	}
	var certificate *tls.CertificateVerificationError
	if errors.As(err, &certificate) {
		return "certificate_rejected"
	}
	var dns *net.DNSError
	if errors.As(err, &dns) {
		return "dns_failed"
	}
	var network net.Error
	if errors.As(err, &network) && network.Timeout() {
		return "timeout"
	}
	var operation *net.OpError
	if errors.As(err, &operation) {
		switch operation.Op {
		case "dial":
			return "connect_failed"
		case "read", "write":
			return "io_failed"
		}
	}
	var imapResponse *imap.Error
	if errors.As(err, &imapResponse) {
		switch {
		case imapResponse.Type == imap.StatusResponseTypeBye:
			return "server_closed"
		case imapResponse.Code == imap.ResponseCodeUnavailable:
			return "server_unavailable"
		default:
			return "server_rejected"
		}
	}
	var smtpResponse *textproto.Error
	if errors.As(err, &smtpResponse) {
		if smtpResponse.Code >= 400 && smtpResponse.Code < 500 {
			return "server_unavailable"
		}
		return "server_rejected"
	}
	return "unknown"
}
