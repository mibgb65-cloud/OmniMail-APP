package mailnet

import (
	"context"
	"errors"
	"time"

	"omnimail/desktop/internal/domain"
)

func (t *Transport) Connect(ctx context.Context, endpoint domain.AccountEndpoint, secret []byte) (domain.MailSession, error) {
	value, err := t.connectOnce(ctx, endpoint, secret)
	if err == nil || ctx.Err() != nil || !canRetryConnection(err) {
		return value, err
	}
	// 只在认证前等待一次；没有重发 LOGIN、写标记、移动邮件或 SMTP DATA。
	timer := time.NewTimer(250 * time.Millisecond)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-timer.C:
		return t.connectOnce(ctx, endpoint, secret)
	}
}

func canRetryConnection(err error) bool {
	var failure *connectionFailure
	if !errors.As(err, &failure) {
		return false
	}
	switch failure.stage {
	case "dial", "tls", "greeting":
	default:
		return false
	}
	switch failure.reason {
	case "server_closed", "connect_failed", "io_failed", "timeout":
		return true
	default:
		return false
	}
}

func tlsFailureCode(err error) error {
	switch connectionFailureReason(err) {
	case "server_closed", "connect_failed", "io_failed", "timeout":
		return domain.ErrNetwork
	default:
		return domain.ErrTLS
	}
}
