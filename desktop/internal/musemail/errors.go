package musemail

import (
	"context"
	"errors"
	"net"

	"omnimail/internal/apperr"
)

func errNotLoggedIn() error {
	return apperr.New(apperr.CodeMuseNotLoggedIn, "尚未检测到有效的 Muse 官方登录会话，请先在登录窗口完成认证")
}

func errAuthExpired() error {
	return apperr.New(apperr.CodeMuseAuthExpired, "Muse 登录会话已过期或失效，请重新打开登录窗口完成验证")
}

func errEmailNotEnabled() error {
	return apperr.New(apperr.CodeMuseNotEnabled, "当前 Meta Muse 账号尚未开通 @muse.ai 邮箱服务")
}

func errIdentityChanged() error {
	return apperr.New(apperr.CodeMuseIdentityChanged, "检测到登录会话对应的 @muse.ai 邮箱已变更，已清空当前内容，请重新验证确认")
}

func errGatewayTimeout() error {
	return apperr.New(apperr.CodeMuseGatewayTimeout, "连接 Muse 邮件服务响应超时，请检查网络后重试")
}

func errGatewayFailed(msg string) error {
	if msg == "" {
		msg = "Muse 邮件网关通信异常，请稍后重试"
	}
	return apperr.New(apperr.CodeMuseGatewayFailed, msg)
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
	if err == nil {
		return nil
	}
	if apperr.CodeOf(err) != "" {
		return err
	}
	if errors.Is(err, context.Canceled) {
		return errCancelled()
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return errGatewayTimeout()
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return errGatewayTimeout()
	}
	return errGatewayFailed("")
}
