package musemail

import (
	"net"
	"net/url"
	"os"
	"strings"

	"golang.org/x/net/http/httpproxy"
)

type proxyResolverFunc func(target *url.URL) (*url.URL, error)

func resolveUpstreamProxyURL(target *url.URL) (*url.URL, error) {
	return resolveProxyWithSource(target, os.Getenv, readSystemProxyConfig)
}

func resolveProxyWithSource(
	target *url.URL,
	getenv func(string) string,
	sysCfg func() (systemProxyConfig, bool),
) (*url.URL, error) {
	if target == nil || target.Host == "" {
		return nil, nil
	}
	if hasAnyProxyEnv(getenv) {
		cfg := httpproxy.Config{
			HTTPProxy:  firstEnv(getenv, "HTTP_PROXY", "http_proxy"),
			HTTPSProxy: firstEnv(getenv, "HTTPS_PROXY", "https_proxy"),
			NoProxy:    firstEnv(getenv, "NO_PROXY", "no_proxy"),
		}
		if cfg.HTTPProxy == "" && cfg.HTTPSProxy == "" {
			allProxy := firstEnv(getenv, "ALL_PROXY", "all_proxy")
			cfg.HTTPProxy = allProxy
			cfg.HTTPSProxy = allProxy
		}
		return cfg.ProxyFunc()(target)
	}
	if sysCfg == nil {
		return nil, nil
	}
	sc, ok := sysCfg()
	if !ok || !sc.Enabled || strings.TrimSpace(sc.Server) == "" {
		return nil, nil
	}
	if matchesWindowsProxyOverride(target.Host, sc.Override) {
		return nil, nil
	}
	return parseWindowsProxyServer(sc.Server, target.Scheme)
}

type systemProxyConfig struct {
	Enabled  bool
	Server   string
	Override string
}

func hasAnyProxyEnv(getenv func(string) string) bool {
	if getenv == nil {
		return false
	}
	for _, k := range []string{"HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy", "NO_PROXY", "no_proxy"} {
		if strings.TrimSpace(getenv(k)) != "" {
			return true
		}
	}
	return false
}

func firstEnv(getenv func(string) string, upper, lower string) string {
	if v := strings.TrimSpace(getenv(upper)); v != "" {
		return v
	}
	return strings.TrimSpace(getenv(lower))
}

// parseWindowsProxyServer 兼容纯 host:port、带协议前缀 URL 以及分协议 http=...;https=...;socks=... 格式。
func parseWindowsProxyServer(rawServer, targetScheme string) (*url.URL, error) {
	cleaned := strings.TrimSpace(rawServer)
	if cleaned == "" {
		return nil, nil
	}
	scheme := strings.ToLower(strings.TrimSpace(targetScheme))
	if scheme == "wss" {
		scheme = "https"
	} else if scheme == "ws" || scheme == "" {
		scheme = "http"
	}

	if !strings.Contains(cleaned, "=") && !strings.Contains(cleaned, ";") {
		return parseSingleProxyEndpoint(cleaned, "http")
	}

	entries := make(map[string]string, 4)
	var fallback string
	for _, seg := range strings.FieldsFunc(cleaned, func(r rune) bool { return r == ';' || r == ' ' || r == '\t' || r == '\r' || r == '\n' }) {
		seg = strings.TrimSpace(seg)
		if seg == "" {
			continue
		}
		if k, v, hasEq := strings.Cut(seg, "="); hasEq {
			entries[strings.ToLower(strings.TrimSpace(k))] = strings.TrimSpace(v)
		} else if fallback == "" {
			fallback = seg
		}
	}

	candidates := []struct{ key, defaultScheme string }{
		{scheme, "http"},
		{"https", "http"},
		{"http", "http"},
		{"socks", "socks5"},
		{"socks5", "socks5"},
	}
	for _, c := range candidates {
		if val := entries[c.key]; val != "" {
			return parseSingleProxyEndpoint(val, c.defaultScheme)
		}
	}
	if fallback != "" {
		return parseSingleProxyEndpoint(fallback, "http")
	}
	return nil, nil
}

func parseSingleProxyEndpoint(raw, defaultScheme string) (*url.URL, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}
	if !strings.Contains(trimmed, "://") {
		trimmed = defaultScheme + "://" + trimmed
	}
	u, err := url.Parse(trimmed)
	if err != nil || u.Host == "" {
		return nil, err
	}
	u.Scheme = strings.ToLower(u.Scheme)
	return u, nil
}

// matchesWindowsProxyOverride 遵循 WinINet ProxyOverride 分号规则（<local>、localhost、环回地址与 * 通配符）。
func matchesWindowsProxyOverride(hostPort, rawOverride string) bool {
	host := hostPort
	if h, _, err := net.SplitHostPort(hostPort); err == nil {
		host = h
	}
	host = strings.ToLower(strings.Trim(strings.TrimSpace(host), "[]"))
	if host == "" {
		return false
	}
	if host == "localhost" || host == "127.0.0.1" || host == "::1" {
		return true
	}
	for _, token := range strings.Split(rawOverride, ";") {
		pat := strings.ToLower(strings.TrimSpace(token))
		if pat == "" {
			continue
		}
		if pat == "<local>" {
			if !strings.Contains(host, ".") && net.ParseIP(host) == nil {
				return true
			}
			continue
		}
		if ph, _, err := net.SplitHostPort(pat); err == nil {
			pat = strings.Trim(ph, "[]")
		}
		if wildcardMatchASCII(pat, host) {
			return true
		}
	}
	return false
}

func wildcardMatchASCII(pattern, s string) bool {
	if pattern == "*" {
		return true
	}
	parts := strings.Split(pattern, "*")
	if len(parts) == 1 {
		return pattern == s
	}
	if !strings.HasPrefix(s, parts[0]) || !strings.HasSuffix(s, parts[len(parts)-1]) {
		return false
	}
	rem := s[len(parts[0]):]
	if len(rem) < len(parts[len(parts)-1]) {
		return false
	}
	rem = rem[:len(rem)-len(parts[len(parts)-1])]
	for _, mid := range parts[1 : len(parts)-1] {
		idx := strings.Index(rem, mid)
		if idx < 0 {
			return false
		}
		rem = rem[idx+len(mid):]
	}
	return true
}
