package musemail

import (
	"context"
	"crypto/tls"
	"net"
	"net/http"
	"time"

	utls "github.com/refraction-networking/utls"
)

const (
	defaultMuseOrigin  = "https://muse.ai"
	defaultGatewayHost = "hatch.metaaivm.com"
	museBrowserUA      = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
)

// newChromeTLSHTTPClient 创建带浏览器 TLS ClientHello 兼容且严格校验系统根证书的 HTTP 客户端（禁止自动重定向）。
func newChromeTLSHTTPClient(alpn []string) *http.Client {
	dialer := &net.Dialer{Timeout: 15 * time.Second, KeepAlive: 30 * time.Second}
	tr := &http.Transport{
		ForceAttemptHTTP2: false,
		MaxIdleConns:      8,
		IdleConnTimeout:   45 * time.Second,
		DialContext:       dialer.DialContext,
		DialTLSContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			return dialVerifiedChromeTLS(ctx, dialer, network, addr, alpn)
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

func dialVerifiedChromeTLS(ctx context.Context, dialer *net.Dialer, network, addr string, alpn []string) (net.Conn, error) {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		host = addr
	}
	rawConn, err := dialer.DialContext(ctx, network, addr)
	if err != nil {
		return nil, err
	}
	spec, err := utls.UTLSIdToSpec(utls.HelloChrome_Auto)
	if err != nil {
		_ = rawConn.Close()
		return nil, err
	}
	if len(alpn) > 0 {
		for _, ext := range spec.Extensions {
			if alpnExt, ok := ext.(*utls.ALPNExtension); ok {
				alpnExt.AlpnProtocols = append([]string(nil), alpn...)
			}
		}
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
		return nil, err
	}
	return uConn, nil
}
