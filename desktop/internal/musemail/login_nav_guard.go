package musemail

import (
	"net/url"
	"strings"
	"time"
)

const museLoginStartURL = "https://muse.ai/"

// allowedLoginHosts 仅允许 Muse 与 Meta 官方登录认证必需的精确主机名，严禁泛域名匹配。
var allowedLoginHosts = map[string]struct{}{
	"muse.ai":                 {},
	"www.muse.ai":             {},
	"auth.muse.ai":            {},
	"meta.ai":                 {},
	"www.meta.ai":             {},
	"auth.meta.com":           {},
	"www.meta.com":            {},
	"accountscenter.meta.com": {},
	"facebook.com":            {},
	"www.facebook.com":        {},
	"m.facebook.com":          {},
	"web.facebook.com":        {},
	"instagram.com":           {},
	"www.instagram.com":       {},
}

// IsAllowedMuseLoginURL 校验独立登录窗口的顶层导航或弹窗地址是否在预先核验的白名单内。
func IsAllowedMuseLoginURL(raw string) bool {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return false
	}
	if strings.EqualFold(trimmed, "about:blank") {
		return true
	}
	u, err := url.Parse(trimmed)
	if err != nil {
		return false
	}
	if !strings.EqualFold(u.Scheme, "https") {
		return false
	}
	if u.User != nil {
		return false
	}
	host := strings.ToLower(strings.TrimSuffix(u.Hostname(), "."))
	if host == "" {
		return false
	}
	_, ok := allowedLoginHosts[host]
	return ok
}

// BuildMinimalMuseCookieHeader 仅筛选 muse.ai / .muse.ai 域未过期会话并校验 hatch_sess 存在。
func BuildMinimalMuseCookieHeader(cookies []RawCookie, now time.Time) (string, error) {
	if len(cookies) == 0 {
		return "", errNotLoggedIn()
	}
	nowUnix := float64(now.Unix())
	seen := make(map[string]string, len(cookies))
	order := make([]string, 0, len(cookies))
	hasSessionToken := false

	for _, c := range cookies {
		domain := strings.ToLower(strings.TrimSpace(c.Domain))
		if domain != "muse.ai" && domain != ".muse.ai" {
			continue
		}
		name := strings.TrimSpace(c.Name)
		val := strings.TrimSpace(c.Value)
		if name == "" || val == "" || hasIllegalCookieByte(name) || hasIllegalCookieByte(val) {
			continue
		}
		if !c.IsSession && c.ExpiresAt > 0 && c.ExpiresAt <= nowUnix {
			continue
		}
		if _, exists := seen[name]; !exists {
			order = append(order, name)
		}
		seen[name] = val
		if name == "hatch_sess" {
			hasSessionToken = true
		}
	}

	if !hasSessionToken {
		return "", errNotLoggedIn()
	}

	parts := make([]string, 0, len(order))
	for _, k := range order {
		parts = append(parts, k+"="+seen[k])
	}
	return strings.Join(parts, "; "), nil
}

func hasIllegalCookieByte(s string) bool {
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if ch < 0x20 || ch == 0x7f || ch == ';' {
			return true
		}
	}
	return false
}
