package mailnet

import (
	"context"
	"errors"
	"net"
	"net/textproto"

	"omnimail/desktop/internal/domain"

	"github.com/emersion/go-imap/v2"
)

func authenticationError(ctx context.Context, conn net.Conn, err error) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}
	var response *imap.Error
	if errors.As(err, &response) {
		switch {
		case response.Type == imap.StatusResponseTypeBye || response.Code == imap.ResponseCodeUnavailable:
			return domain.ErrNetwork
		case response.Code == imap.ResponseCodePrivacyRequired:
			return domain.ErrTLS
		case response.Type == imap.StatusResponseTypeNo && isAuthenticationResponse(response.Code):
			// Gmail 会用 NO [ALERT] 拒绝未满足应用密码/安全策略的登录。
			// 按认证阶段和结构化状态判断，不匹配或泄露服务器文本；BAD 仍是协议错误。
			return domain.ErrAuthentication
		default:
			return domain.ErrProtocol
		}
	}
	var smtpResponse *textproto.Error
	if errors.As(err, &smtpResponse) {
		switch {
		case smtpResponse.Code >= 400 && smtpResponse.Code < 500:
			// 临时认证服务不可用不是密码错误，避免引导用户反复重置有效凭据。
			return domain.ErrNetwork
		case smtpResponse.Code == 538:
			return domain.ErrTLS
		case smtpResponse.Code == 530 || smtpResponse.Code == 534 || smtpResponse.Code == 535:
			return domain.ErrAuthentication
		default:
			return domain.ErrProtocol
		}
	}
	// 解码器可能用文本包装 I/O 错误；复用底层读取证据，不把断线/超时误报为密码错误。
	if failure := connectionReadError(conn); failure != nil {
		err = failure
	}
	return classifyIMAPFailure(err)
}

func isAuthenticationResponse(code imap.ResponseCode) bool {
	switch code {
	case "", imap.ResponseCodeAlert, imap.ResponseCodeAuthenticationFailed,
		imap.ResponseCodeAuthorizationFailed, imap.ResponseCodeExpired, imap.ResponseCodeContactAdmin:
		return true
	default:
		return false
	}
}
