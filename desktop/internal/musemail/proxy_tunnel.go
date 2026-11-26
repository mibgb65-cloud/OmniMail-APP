package musemail

import (
	"bufio"
	"context"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"golang.org/x/net/proxy"
)

type bufferedTunnelConn struct {
	net.Conn
	br *bufio.Reader
}

func (c *bufferedTunnelConn) Read(p []byte) (int, error) {
	if c.br != nil && c.br.Buffered() > 0 {
		return c.br.Read(p)
	}
	return c.Conn.Read(p)
}

func dialProxyAwareTCP(
	ctx context.Context,
	dialer *net.Dialer,
	network, addr, targetScheme string,
	proxyResolver proxyResolverFunc,
) (net.Conn, error) {
	if proxyResolver == nil {
		return dialer.DialContext(ctx, network, addr)
	}
	targetURL := &url.URL{Scheme: targetScheme, Host: addr}
	proxyURL, err := proxyResolver(targetURL)
	if err != nil || proxyURL == nil || proxyURL.Host == "" {
		return dialer.DialContext(ctx, network, addr)
	}

	scheme := strings.ToLower(proxyURL.Scheme)
	switch scheme {
	case "http", "https":
		if targetScheme == "http" {
			return dialer.DialContext(ctx, network, addr)
		}
		return dialHTTPConnectTunnel(ctx, dialer, network, proxyURL, addr)
	case "socks5", "socks5h", "socks":
		return dialSOCKS5Tunnel(ctx, dialer, network, proxyURL, addr)
	default:
		return dialer.DialContext(ctx, network, addr)
	}
}

func dialHTTPConnectTunnel(ctx context.Context, dialer *net.Dialer, network string, proxyURL *url.URL, targetAddr string) (net.Conn, error) {
	proxyAddr := ensureDefaultPort(proxyURL.Host, proxyURL.Scheme)
	conn, err := dialer.DialContext(ctx, network, proxyAddr)
	if err != nil {
		return nil, fmt.Errorf("proxy_dial: %w", err)
	}
	if strings.EqualFold(proxyURL.Scheme, "https") {
		proxyHost, _, splitErr := net.SplitHostPort(proxyAddr)
		if splitErr != nil {
			proxyHost = proxyAddr
		}
		tlsProxy := tls.Client(conn, &tls.Config{ServerName: proxyHost, MinVersion: tls.VersionTLS12})
		if err := tlsProxy.HandshakeContext(ctx); err != nil {
			_ = conn.Close()
			return nil, fmt.Errorf("proxy_tls: %w", err)
		}
		conn = tlsProxy
	}

	if dl, hasDL := ctx.Deadline(); hasDL {
		_ = conn.SetDeadline(dl)
	} else {
		_ = conn.SetDeadline(time.Now().Add(15 * time.Second))
	}
	defer func() { _ = conn.SetDeadline(time.Time{}) }()

	var reqBuf strings.Builder
	reqBuf.WriteString("CONNECT ")
	reqBuf.WriteString(targetAddr)
	reqBuf.WriteString(" HTTP/1.1\r\nHost: ")
	reqBuf.WriteString(targetAddr)
	reqBuf.WriteString("\r\nUser-Agent: ")
	reqBuf.WriteString(museBrowserUA)
	reqBuf.WriteString("\r\n")
	if authHdr := buildProxyBasicAuthHeader(proxyURL.User); authHdr != "" {
		reqBuf.WriteString("Proxy-Authorization: ")
		reqBuf.WriteString(authHdr)
		reqBuf.WriteString("\r\n")
	}
	reqBuf.WriteString("\r\n")

	if _, err := io.WriteString(conn, reqBuf.String()); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("proxy_connect_write: %w", err)
	}

	br := bufio.NewReaderSize(conn, 2048)
	resp, err := http.ReadResponse(br, &http.Request{Method: http.MethodConnect})
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("proxy_connect_read: %w", err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		_ = conn.Close()
		return nil, fmt.Errorf("proxy_connect_status_%d", resp.StatusCode)
	}
	if br.Buffered() > 0 {
		return &bufferedTunnelConn{Conn: conn, br: br}, nil
	}
	return conn, nil
}

func dialSOCKS5Tunnel(ctx context.Context, dialer *net.Dialer, network string, proxyURL *url.URL, targetAddr string) (net.Conn, error) {
	var auth *proxy.Auth
	if proxyURL.User != nil {
		pwd, _ := proxyURL.User.Password()
		auth = &proxy.Auth{User: proxyURL.User.Username(), Password: pwd}
	}
	proxyAddr := ensureDefaultPort(proxyURL.Host, "socks5")
	socksDialer, err := proxy.SOCKS5("tcp", proxyAddr, auth, dialer)
	if err != nil {
		return nil, fmt.Errorf("socks5_init: %w", err)
	}
	if cd, ok := socksDialer.(proxy.ContextDialer); ok {
		conn, dErr := cd.DialContext(ctx, network, targetAddr)
		if dErr != nil {
			return nil, fmt.Errorf("socks5_dial: %w", dErr)
		}
		return conn, nil
	}
	conn, err := socksDialer.Dial(network, targetAddr)
	if err != nil {
		return nil, fmt.Errorf("socks5_dial: %w", err)
	}
	return conn, nil
}

func buildProxyBasicAuthHeader(u *url.Userinfo) string {
	if u == nil || u.Username() == "" {
		return ""
	}
	pwd, _ := u.Password()
	token := base64.StdEncoding.EncodeToString([]byte(u.Username() + ":" + pwd))
	return "Basic " + token
}

func ensureDefaultPort(hostPort, scheme string) string {
	if _, _, err := net.SplitHostPort(hostPort); err == nil {
		return hostPort
	}
	switch strings.ToLower(scheme) {
	case "https":
		return net.JoinHostPort(strings.Trim(hostPort, "[]"), "443")
	case "socks5", "socks5h", "socks":
		return net.JoinHostPort(strings.Trim(hostPort, "[]"), "1080")
	default:
		return net.JoinHostPort(strings.Trim(hostPort, "[]"), "80")
	}
}
