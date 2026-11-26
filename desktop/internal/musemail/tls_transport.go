package musemail

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"slices"
	"time"

	utls "github.com/refraction-networking/utls"
)

const (
	defaultMuseOrigin  = "https://muse.ai"
	defaultGatewayHost = "hatch.metaaivm.com"
	museBrowserUA      = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
)

func normalizeALPNProtos(alpn []string) []string {
	var out []string
	for _, p := range alpn {
		if p != "" && !slices.Contains(out, p) {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return []string{"http/1.1"}
	}
	return out
}

// newChromeTLSHTTPClient 创建带浏览器 TLS ClientHello 兼容、代理感知且严格校验系统根证书的 HTTP/1.1 客户端。
func newChromeTLSHTTPClient(alpnProtos []string) *http.Client {
	return newChromeTLSHTTPClientWithProxy(alpnProtos, resolveUpstreamProxyURL)
}

func newChromeTLSHTTPClientWithProxy(alpnProtos []string, proxyResolver proxyResolverFunc) *http.Client {
	allowedALPN := normalizeALPNProtos(alpnProtos)
	dialer := &net.Dialer{Timeout: 15 * time.Second, KeepAlive: 30 * time.Second}
	tr := &http.Transport{
		ForceAttemptHTTP2: false,
		MaxIdleConns:      8,
		IdleConnTimeout:   45 * time.Second,
		Proxy: func(req *http.Request) (*url.URL, error) {
			if req == nil || req.URL == nil || req.URL.Scheme != "http" {
				return nil, nil
			}
			u, err := proxyResolver(req.URL)
			if err != nil || u == nil {
				return nil, err
			}
			if u.Scheme == "http" || u.Scheme == "https" {
				return u, nil
			}
			return nil, nil
		},
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			return dialProxyAwareTCP(ctx, dialer, network, addr, "http", proxyResolver)
		},
		DialTLSContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			return dialVerifiedChromeTLSWithProxy(ctx, dialer, network, addr, allowedALPN, proxyResolver)
		},
	}
	return &http.Client{
		Transport: tr,
		Timeout:   25 * time.Second,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

func dialVerifiedChromeTLS(ctx context.Context, dialer *net.Dialer, network, addr string, alpnProtos []string) (net.Conn, error) {
	return dialVerifiedChromeTLSWithProxy(ctx, dialer, network, addr, alpnProtos, resolveUpstreamProxyURL)
}

func dialVerifiedChromeTLSWithProxy(ctx context.Context, dialer *net.Dialer, network, addr string, alpnProtos []string, proxyResolver proxyResolverFunc) (net.Conn, error) {
	allowedALPN := normalizeALPNProtos(alpnProtos)
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		host = addr
	}
	rawConn, err := dialProxyAwareTCP(ctx, dialer, network, addr, "https", proxyResolver)
	if err != nil {
		return nil, err
	}
	spec, err := buildChromeClientHelloSpec(allowedALPN)
	if err != nil {
		_ = rawConn.Close()
		return nil, err
	}
	uConn := utls.UClient(rawConn, &utls.Config{
		ServerName:         host,
		MinVersion:         tls.VersionTLS12,
		InsecureSkipVerify: false,
	}, utls.HelloCustom)
	if err := uConn.ApplyPreset(&spec); err != nil {
		_ = rawConn.Close()
		return nil, err
	}
	if err := uConn.HandshakeContext(ctx); err != nil {
		_ = rawConn.Close()
		return nil, fmt.Errorf("tls_handshake: %w", err)
	}
	negotiated := uConn.ConnectionState().NegotiatedProtocol
	if err := verifyNegotiatedALPN(negotiated, allowedALPN); err != nil {
		_ = uConn.Close()
		return nil, err
	}
	return uConn, nil
}

func buildChromeClientHelloSpec(allowedALPN []string) (utls.ClientHelloSpec, error) {
	allowedALPN = normalizeALPNProtos(allowedALPN)
	spec, err := utls.UTLSIdToSpec(utls.HelloChrome_Auto)
	if err != nil {
		return utls.ClientHelloSpec{}, err
	}
	allowH2 := slices.Contains(allowedALPN, "h2")
	filtered := make([]utls.TLSExtension, 0, len(spec.Extensions))
	hasALPN := false
	for _, ext := range spec.Extensions {
		switch e := ext.(type) {
		case *utls.ALPNExtension:
			e.AlpnProtocols = append([]string(nil), allowedALPN...)
			hasALPN = true
			filtered = append(filtered, e)
		case *utls.ApplicationSettingsExtension, *utls.ApplicationSettingsExtensionNew:
			if allowH2 {
				filtered = append(filtered, ext)
			}
		default:
			filtered = append(filtered, ext)
		}
	}
	if !hasALPN {
		filtered = append(filtered, &utls.ALPNExtension{AlpnProtocols: append([]string(nil), allowedALPN...)})
	}
	spec.Extensions = filtered
	return spec, nil
}

func verifyNegotiatedALPN(negotiated string, allowedALPN []string) error {
	if negotiated == "" {
		return nil
	}
	if slices.Contains(allowedALPN, negotiated) {
		return nil
	}
	return errGatewayFailed(fmt.Sprintf("TLS ALPN 协议不匹配（服务端返回 %s，预期 %s）", sanitizeDiagnosticToken(negotiated), allowedALPN[0]))
}
