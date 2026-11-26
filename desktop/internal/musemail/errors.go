package musemail

import (
	"context"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"

	"omnimail/internal/apperr"
)

const (
	stageSession     = "session"
	stageAuthCheck   = "auth_check"
	stageHatchToken  = "hatch_token"
	stageWSDial      = "ws_dial"
	stageNoiseXX     = "noise_xx"
	stageMailboxGet  = "mailbox_get"
	stageThreadsList = "threads_list"
	stageThreadsGet  = "threads_get"
)

func errNotLoggedIn() error {
	return apperr.New(apperr.CodeMuseNotLoggedIn, "尚未检测到有效的 Muse 官方登录会话，请先在登录窗口完成认证")
}

func errAuthExpired() error {
	return errStageAuthExpired("", 0)
}

func errStageAuthExpired(stage string, statusCode int) error {
	msg := "Muse 登录会话已过期或失效，请重新打开登录窗口完成验证"
	if statusCode > 0 {
		msg = fmt.Sprintf("%s（HTTP %d）", msg, statusCode)
	}
	return apperr.New(apperr.CodeMuseAuthExpired, prefixStageTag(stage, msg))
}

func errEmailNotEnabled() error {
	return apperr.New(apperr.CodeMuseNotEnabled, "当前 Meta Muse 账号尚未开通 @muse.ai 邮箱服务")
}

func errIdentityChanged() error {
	return apperr.New(apperr.CodeMuseIdentityChanged, "检测到登录会话对应的 @muse.ai 邮箱已变更，已清空当前内容，请重新验证确认")
}

func errGatewayTimeout() error {
	return errStageGatewayTimeout("")
}

func errStageGatewayTimeout(stage string) error {
	return apperr.New(apperr.CodeMuseGatewayTimeout, prefixStageTag(stage, "连接 Muse 邮件服务响应超时，请检查网络后重试"))
}

func errGatewayFailed(msg string) error {
	return errStageGatewayFailed("", msg)
}

func errStageGatewayFailed(stage, msg string) error {
	if msg == "" {
		msg = "Muse 邮件网关通信异常，请稍后重试"
	}
	return apperr.New(apperr.CodeMuseGatewayFailed, prefixStageTag(stage, msg))
}

func errUnsupported(msg string) error {
	if msg == "" {
		msg = "当前环境不支持独立 WebView2 登录或该操作未开放"
	}
	return apperr.New(apperr.CodeMuseUnsupported, msg)
}

func errCancelled() error {
	return apperr.New(apperr.CodeMuseCancelled, "已取消当前 Muse Mail 请求")
}

func classifyContextOrNetErr(err error) error {
	return classifyStageNetErr("", err)
}

func classifyStageNetErr(stage string, err error) error {
	if err == nil {
		return nil
	}
	if code := apperr.CodeOf(err); code != "" {
		var ae *apperr.AppError
		if stage != "" && errors.As(err, &ae) && !strings.HasPrefix(ae.Message, "[") {
			return apperr.Wrap(ae.Code, prefixStageTag(stage, ae.Message), ae.Cause)
		}
		return err
	}
	if errors.Is(err, context.Canceled) {
		return errCancelled()
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return errStageGatewayTimeout(stage)
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return errStageGatewayTimeout(stage)
	}
	reason := summarizeSanitizedNetReason(err)
	msg := "Muse 邮件网关通信异常，请稍后重试"
	if reason != "" {
		msg = fmt.Sprintf("Muse 邮件网关通信异常（%s），请稍后重试", reason)
	}
	return apperr.Wrap(apperr.CodeMuseGatewayFailed, prefixStageTag(stage, msg), nil)
}

func prefixStageTag(stage, msg string) string {
	s := sanitizeDiagnosticToken(stage)
	if s == "" || strings.HasPrefix(msg, "["+s+"]") {
		return msg
	}
	return "[" + s + "] " + msg
}

// summarizeSanitizedNetReason 提取严格白名单化的网络/TLS/代理错误分类，绝不拼入原始 URL、查询参数、Cookie、Token 或响应体。
func summarizeSanitizedNetReason(err error) string {
	if err == nil {
		return ""
	}
	var certInvalid x509.CertificateInvalidError
	var unknownAuth x509.UnknownAuthorityError
	var hostErr x509.HostnameError
	if errors.As(err, &certInvalid) || errors.As(err, &unknownAuth) || errors.As(err, &hostErr) {
		return "tls_cert_verify_failed"
	}
	var dnsErr *net.DNSError
	if errors.As(err, &dnsErr) {
		return "dns_lookup_failed"
	}
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return "unexpected_eof"
	}
	low := strings.ToLower(err.Error())
	switch {
	case strings.Contains(low, "proxy_connect_status_"):
		if idx := strings.Index(low, "proxy_connect_status_"); idx >= 0 {
			return sanitizeDiagnosticToken(low[idx:min(len(low), idx+24)])
		}
		return "proxy_connect_rejected"
	case strings.Contains(low, "proxy_"):
		return "proxy_tunnel_failed"
	case strings.Contains(low, "socks5_"):
		return "socks5_tunnel_failed"
	case strings.Contains(low, "tls_handshake") || strings.Contains(low, "tls:") || strings.Contains(low, "remote error:"):
		return "tls_handshake_failed"
	case strings.Contains(low, "malformed http") || strings.Contains(low, "frame"):
		return "http_protocol_mismatch"
	case strings.Contains(low, "refused") || strings.Contains(low, "actively refused"):
		return "connection_refused"
	case strings.Contains(low, "reset") || strings.Contains(low, "forcibly closed") || strings.Contains(low, "aborted"):
		return "connection_reset"
	case strings.Contains(low, "unreachable"):
		return "network_unreachable"
	case strings.Contains(low, "websocket") || strings.Contains(low, "status"):
		return "ws_upgrade_failed"
	default:
		var opErr *net.OpError
		if errors.As(err, &opErr) && opErr.Op != "" {
			return "net_" + sanitizeDiagnosticToken(opErr.Op)
		}
		return "transport_io_error"
	}
}

func sanitizeDiagnosticToken(raw string) string {
	var b strings.Builder
	for i := 0; i < len(raw) && b.Len() < 32; i++ {
		ch := raw[i]
		if (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_' || ch == '-' || ch == '.' || ch == '/' {
			b.WriteByte(ch)
		}
	}
	return b.String()
}

func stageForRoute(routeName string) string {
	switch routeName {
	case routeMailboxGet:
		return stageMailboxGet
	case routeThreadsList:
		return stageThreadsList
	case routeThreadsGet:
		return stageThreadsGet
	default:
		return "gateway_rpc"
	}
}
