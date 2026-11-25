package workbuddymail

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"omnimail/internal/apperr"
)

const (
	loginTokenPendingCode   = 11217
	loginAccountPendingCode = 12151
)

var allowedAPIDomains = map[string]struct{}{
	"www.workbuddy.cn":    {},
	"copilot.tencent.com": {},
	"www.codebuddy.cn":    {},
	"wb.tencentbuddy.com": {},
}

func ResolveBaseURL(raw string, allowLoopback bool) (string, string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		trimmed = DefaultBaseURL
	} else if !strings.Contains(trimmed, "://") {
		trimmed = "https://" + trimmed
	}
	u, err := url.Parse(trimmed)
	if err != nil || u.Host == "" || u.User != nil {
		return "", "", apperr.New(apperr.CodeInvalidInput, "WorkBuddy 服务地址格式无效")
	}
	host := strings.ToLower(u.Hostname())
	scheme := strings.ToLower(u.Scheme)
	if isLoopbackHost(host) && allowLoopback && (scheme == "http" || scheme == "https") {
		return scheme + "://" + u.Host, u.Host, nil
	}
	if scheme != "https" {
		return "", "", apperr.New(apperr.CodeInvalidInput, "WorkBuddy 服务仅允许 HTTPS 安全连接")
	}
	if _, ok := allowedAPIDomains[host]; !ok {
		return "", "", apperr.New(apperr.CodeInvalidInput, "不支持的 WorkBuddy 服务域名")
	}
	return "https://" + u.Host, u.Host, nil
}

func ValidateAuthBrowserURL(rawURL string, allowLoopback bool) (string, error) {
	trimmed := strings.TrimSpace(rawURL)
	u, err := url.Parse(trimmed)
	if err != nil || u.Host == "" || u.User != nil {
		return "", apperr.New(apperr.CodeWBGatewayFailed, "WorkBuddy 授权页面地址无效")
	}
	host := strings.ToLower(u.Hostname())
	scheme := strings.ToLower(u.Scheme)
	if isLoopbackHost(host) && allowLoopback && (scheme == "http" || scheme == "https") {
		return u.String(), nil
	}
	if scheme != "https" || !isTrustedAuthHost(host) {
		return "", apperr.New(apperr.CodeWBGatewayFailed, "WorkBuddy 授权跳转域名未通过安全校验")
	}
	return u.String(), nil
}

func isTrustedAuthHost(host string) bool {
	for _, sfx := range []string{"workbuddy.cn", "codebuddy.cn", "tencentbuddy.com", "tencent.com", "qq.com"} {
		if host == sfx || strings.HasSuffix(host, "."+sfx) {
			return true
		}
	}
	return false
}

func isLoopbackHost(host string) bool {
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func newSafeHTTPClient(timeout time.Duration, allowLoopback bool) *http.Client {
	return &http.Client{
		Timeout: timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 {
				return errors.New("redirect limit exceeded")
			}
			prev := via[len(via)-1].URL
			if !strings.EqualFold(req.URL.Host, prev.Host) {
				return http.ErrUseLastResponse
			}
			if !allowLoopback && !strings.EqualFold(req.URL.Scheme, "https") {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}
}

func ParseDailyQuotaHeaders(h http.Header) DailyQuota {
	lim, okLim := parseHeaderInt(h.Get("X-DailyQuota-Limit"))
	rem, okRem := parseHeaderInt(h.Get("X-DailyQuota-Remaining"))
	rst, okRst := parseHeaderInt(h.Get("X-DailyQuota-Reset"))
	return DailyQuota{
		Limit:     lim,
		Remaining: rem,
		Reset:     rst,
		HasQuota:  okLim || okRem || okRst,
	}
}

func parseHeaderInt(v string) (int, bool) {
	v = strings.TrimSpace(v)
	if v == "" {
		return 0, false
	}
	n, err := strconv.Atoi(v)
	return n, err == nil
}

type apiEnvelope struct {
	Code int             `json:"code"`
	Msg  string          `json:"msg"`
	Data json.RawMessage `json:"data"`
}

func unwrapEnvelope(body []byte) (int, string, []byte) {
	var env apiEnvelope
	if err := json.Unmarshal(body, &env); err == nil {
		if len(env.Data) > 0 && string(env.Data) != "null" {
			return env.Code, env.Msg, env.Data
		}
		if env.Code != 0 || env.Msg != "" {
			return env.Code, env.Msg, nil
		}
	}
	return 0, "", body
}

func computeExpiresAt(expiresAt int64, expiresIn int64) int64 {
	if expiresAt > 0 {
		if expiresAt < 1e11 {
			return expiresAt * 1000
		}
		return expiresAt
	}
	if expiresIn > 0 {
		return time.Now().Add(time.Duration(expiresIn) * time.Second).UnixMilli()
	}
	return 0
}

func normalizeContextErr(err error) error {
	if errors.Is(err, context.Canceled) {
		return apperr.New(apperr.CodeWBCancelled, "已取消 WorkBuddy 授权操作")
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return apperr.New(apperr.CodeWBAuthTimeout, "等待浏览器授权超时，请重新发起授权")
	}
	var ae *apperr.AppError
	if errors.As(err, &ae) {
		return err
	}
	return apperr.New(apperr.CodeWBGatewayFailed, "连接 WorkBuddy 服务失败，请检查网络设置")
}
