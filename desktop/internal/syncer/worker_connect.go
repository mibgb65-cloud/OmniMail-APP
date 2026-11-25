package syncer

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/emersion/go-imap/v2/imapclient"

	"omnimail/internal/apperr"
	"omnimail/internal/mailproto"
	"omnimail/internal/security"
)

var transientConnectBackoffs = []time.Duration{
	1500 * time.Millisecond,
	3000 * time.Millisecond,
}

func isTransientConnectError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.Canceled) {
		return false
	}
	if apperr.CodeOf(err) == apperr.CodeAuthExpired {
		return false
	}
	low := strings.ToLower(err.Error())
	for _, kw := range []string{
		"authenticationfailed",
		"authenticate failed",
		"invalid credentials",
		"login failed",
		"auth failed",
		"bad credentials",
		"username or password",
	} {
		if strings.Contains(low, kw) {
			return false
		}
	}
	return isConnectionLevelError(err)
}

func classifyConnectStatus(err error) string {
	if apperr.CodeOf(err) == apperr.CodeAuthExpired {
		return "auth-expired"
	}
	low := strings.ToLower(err.Error())
	for _, kw := range []string{
		"authenticationfailed",
		"invalid credentials",
		"bad credentials",
	} {
		if strings.Contains(low, kw) {
			return "auth-expired"
		}
	}
	return "error"
}

func formatStageLastError(stage string, err error) string {
	if err == nil {
		return ""
	}
	detail := strings.TrimSpace(security.RedactSensitive(err.Error()))
	detail = strings.Join(strings.Fields(detail), " ")
	if utf8.RuneCountInString(detail) > 180 {
		runes := []rune(detail)
		detail = string(runes[:180]) + "…"
	}
	if stage == "" || strings.HasPrefix(detail, stage) {
		return detail
	}
	return fmt.Sprintf("%s：%s", stage, detail)
}

func connectWithTransientRetry(
	ctx context.Context,
	dial imapReconnectFunc,
	delays []time.Duration,
	jitterMax time.Duration,
) (*imapclient.Client, int, error) {
	if dial == nil {
		return nil, 0, errors.New("未配置 IMAP 连接器")
	}
	maxRetries := len(delays)
	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if ctx != nil && ctx.Err() != nil {
			return nil, attempt, ctx.Err()
		}
		cli, err := dial()
		if err == nil {
			return cli, attempt, nil
		}
		lastErr = err
		if attempt >= maxRetries || !isTransientConnectError(err) {
			return nil, attempt + 1, lastErr
		}
		wait := delays[attempt]
		if jitterMax > 0 {
			wait += time.Duration(rand.Int64N(int64(jitterMax)))
		}
		if !sleepCtx(ctx, wait) {
			return nil, attempt + 1, ctx.Err()
		}
	}
	return nil, maxRetries + 1, lastErr
}

func sleepCtx(ctx context.Context, d time.Duration) bool {
	if d <= 0 {
		return ctx == nil || ctx.Err() == nil
	}
	t := time.NewTimer(d)
	defer t.Stop()
	if ctx == nil {
		<-t.C
		return true
	}
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}

func connectEndpointStageLabel(cfg mailproto.EndpointConfig) string {
	if cfg.ImapPort > 0 {
		return fmt.Sprintf("连接收件服务器失败（IMAP %d）", cfg.ImapPort)
	}
	return "连接收件服务器失败"
}
