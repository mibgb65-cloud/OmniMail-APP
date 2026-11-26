package musemail

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	utls "github.com/refraction-networking/utls"

	"omnimail/internal/apperr"
)

func TestALPNStrictHTTP11AndSpecStripsH2ALPS(t *testing.T) {
	if got := normalizeALPNProtos(nil); !slices.Equal(got, []string{"http/1.1"}) {
		t.Fatalf("空 ALPN 应回退为 [http/1.1]: %v", got)
	}
	spec, err := buildChromeClientHelloSpec(nil)
	if err != nil {
		t.Fatalf("buildChromeClientHelloSpec 失败: %v", err)
	}
	foundALPN := false
	for _, ext := range spec.Extensions {
		switch e := ext.(type) {
		case *utls.ALPNExtension:
			foundALPN = true
			if !slices.Equal(e.AlpnProtocols, []string{"http/1.1"}) {
				t.Fatalf("ALPN 扩展协议列表必须仅为 [http/1.1], got=%v", e.AlpnProtocols)
			}
		case *utls.ApplicationSettingsExtension, *utls.ApplicationSettingsExtensionNew:
			t.Fatalf("禁用 h2 时必须剥离 Chrome ALPS 扩展以防服务端报错: %T", ext)
		}
	}
	if !foundALPN {
		t.Fatal("ClientHelloSpec 缺少 ALPNExtension")
	}

	if err := verifyNegotiatedALPN("http/1.1", []string{"http/1.1"}); err != nil {
		t.Fatalf("协商 http/1.1 应放行: %v", err)
	}
	if err := verifyNegotiatedALPN("", []string{"http/1.1"}); err != nil {
		t.Fatalf("未显式回传 ALPN 应兼容 HTTP/1.1: %v", err)
	}
	mismatchErr := verifyNegotiatedALPN("h2", []string{"http/1.1"})
	if apperr.CodeOf(mismatchErr) != apperr.CodeMuseGatewayFailed || !strings.Contains(mismatchErr.Error(), "ALPN") {
		t.Fatalf("非预期 h2 协商必须返回 ERR_MUSE_GATEWAY_FAILED 诊断错误: %v", mismatchErr)
	}

	conn := NewLiveConnector()
	for name, cli := range map[string]*http.Client{"HTTPClient": conn.HTTPClient, "WSDialHTTP": conn.WSDialHTTP} {
		tr, ok := cli.Transport.(*http.Transport)
		if !ok || tr.ForceAttemptHTTP2 {
			t.Fatalf("%s Transport 必须保持 ForceAttemptHTTP2=false", name)
		}
	}
}

func TestProxyResolutionEnvRegistryAndBypass(t *testing.T) {
	targetHTTPS, _ := url.Parse("https://muse.ai/api/session")
	targetWSS, _ := url.Parse("wss://hatch.metaaivm.com/v1/noise")

	// 1. 环境变量优先于 Windows 注册表
	envMap := map[string]string{"HTTPS_PROXY": "http://127.0.0.1:7890", "NO_PROXY": "*.internal.corp"}
	u, err := resolveProxyWithSource(targetHTTPS, func(k string) string { return envMap[k] }, func() (systemProxyConfig, bool) {
		return systemProxyConfig{Enabled: true, Server: "127.0.0.1:10808"}, true
	})
	if err != nil || u == nil || u.String() != "http://127.0.0.1:7890" {
		t.Fatalf("HTTPS_PROXY 优先级解析错误: u=%v err=%v", u, err)
	}

	// 2. 纯 host:port 注册表格式
	u2, err := resolveProxyWithSource(targetHTTPS, func(string) string { return "" }, func() (systemProxyConfig, bool) {
		return systemProxyConfig{Enabled: true, Server: "127.0.0.1:10808", Override: "<local>;*.lan"}, true
	})
	if err != nil || u2 == nil || u2.String() != "http://127.0.0.1:10808" {
		t.Fatalf("纯 host:port 注册表解析错误: u=%v err=%v", u2, err)
	}

	// 3. 分协议 http=...;https=... 与 socks=... 格式
	u3, err := resolveProxyWithSource(targetWSS, func(string) string { return "" }, func() (systemProxyConfig, bool) {
		return systemProxyConfig{Enabled: true, Server: "http=127.0.0.1:7890;https=127.0.0.1:7891"}, true
	})
	if err != nil || u3 == nil || u3.String() != "http://127.0.0.1:7891" {
		t.Fatalf("分协议 https= 解析错误: u=%v err=%v", u3, err)
	}
	u4, err := resolveProxyWithSource(targetHTTPS, func(string) string { return "" }, func() (systemProxyConfig, bool) {
		return systemProxyConfig{Enabled: true, Server: "socks=127.0.0.1:10808"}, true
	})
	if err != nil || u4 == nil || u4.Scheme != "socks5" || u4.Host != "127.0.0.1:10808" {
		t.Fatalf("socks= 格式解析错误: u=%v err=%v", u4, err)
	}

	// 4. ProxyOverride 绕过规则（<local>、localhost、127.0.0.1、通配符）
	for _, bypassed := range []string{"localhost:8080", "127.0.0.1:9000", "intranet-box", "api.corp.local"} {
		if !matchesWindowsProxyOverride(bypassed, "<local>;*.corp.local") {
			t.Fatalf("应命中 ProxyOverride 绕过规则: %s", bypassed)
		}
	}
	if matchesWindowsProxyOverride("muse.ai:443", "<local>;*.corp.local") {
		t.Fatal("公网域名 muse.ai 不应误命中绕过规则")
	}
}

func TestHTTPConnectProxyTunnelAndAuthHandshake(t *testing.T) {
	echoLn, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer echoLn.Close()
	go func() {
		conn, aErr := echoLn.Accept()
		if aErr != nil {
			return
		}
		defer conn.Close()
		buf := make([]byte, 4)
		if _, err := io.ReadFull(conn, buf); err == nil {
			_, _ = conn.Write([]byte("PONG:" + string(buf)))
		}
	}()

	var connectHits atomic.Int32
	var gotAuth atomic.Value
	proxyLn, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer proxyLn.Close()
	go func() {
		c, aErr := proxyLn.Accept()
		if aErr != nil {
			return
		}
		defer c.Close()
		br := bufio.NewReader(c)
		req, rErr := http.ReadRequest(br)
		if rErr != nil || req.Method != http.MethodConnect {
			return
		}
		connectHits.Add(1)
		gotAuth.Store(req.Header.Get("Proxy-Authorization"))
		up, dErr := net.Dial("tcp", req.Host)
		if dErr != nil {
			_, _ = io.WriteString(c, "HTTP/1.1 502 Bad Gateway\r\n\r\n")
			return
		}
		defer up.Close()
		_, _ = io.WriteString(c, "HTTP/1.1 200 Connection Established\r\n\r\n")
		go func() { _, _ = io.Copy(up, br) }()
		_, _ = io.Copy(c, up)
	}()

	proxyURL, _ := url.Parse(fmt.Sprintf("http://alice:s3cr3t@%s", proxyLn.Addr().String()))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	tunConn, err := dialProxyAwareTCP(
		ctx,
		&net.Dialer{Timeout: 3 * time.Second},
		"tcp",
		echoLn.Addr().String(),
		"https",
		func(*url.URL) (*url.URL, error) { return proxyURL, nil },
	)
	if err != nil {
		t.Fatalf("通过 HTTP CONNECT 代理建立隧道失败: %v", err)
	}
	defer tunConn.Close()

	if _, err := tunConn.Write([]byte("PING")); err != nil {
		t.Fatal(err)
	}
	reply := make([]byte, 9)
	if _, err := io.ReadFull(tunConn, reply); err != nil {
		t.Fatal(err)
	}
	if string(reply) != "PONG:PING" || connectHits.Load() != 1 {
		t.Fatalf("代理隧道转发数据不符: reply=%q hits=%d", string(reply), connectHits.Load())
	}
	if auth, _ := gotAuth.Load().(string); !strings.HasPrefix(auth, "Basic ") {
		t.Fatalf("未携带预期 Proxy-Authorization Basic 头: %q", auth)
	}
}
