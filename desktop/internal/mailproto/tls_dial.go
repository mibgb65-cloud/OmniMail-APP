package mailproto

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"strings"
	"time"
)

const defaultDialTimeout = 10 * time.Second

// BuildTLSConfig 生成强制 TLS >= 1.2 的安全配置；若提供固定证书指纹，仅放行完全匹配的证书。
func BuildTLSConfig(serverName, pinnedSHA256 string) *tls.Config {
	pin := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(pinnedSHA256), ":", ""))
	cfg := &tls.Config{
		ServerName: strings.TrimSpace(serverName),
		MinVersion: tls.VersionTLS12,
	}
	if pin != "" {
		cfg.InsecureSkipVerify = true
		cfg.VerifyPeerCertificate = func(rawCerts [][]byte, _ [][]*x509.Certificate) error {
			if len(rawCerts) == 0 {
				return errors.New("服务器未返回任何 TLS 证书")
			}
			sum := sha256.Sum256(rawCerts[0])
			got := hex.EncodeToString(sum[:])
			if got != pin {
				return fmt.Errorf("服务器证书指纹不匹配（期望 %s，实际 %s）", pin, got)
			}
			return nil
		}
	}
	return cfg
}

func DialTCP(ctx context.Context, host string, port int) (net.Conn, error) {
	addr := net.JoinHostPort(strings.TrimSpace(host), fmt.Sprintf("%d", port))
	d := net.Dialer{Timeout: defaultDialTimeout, KeepAlive: 30 * time.Second}
	return d.DialContext(ctx, "tcp", addr)
}

// ProbeUntrustedFingerprint 在标准证书链校验失败时提取叶子证书 SHA-256 指纹供用户确认固定。
func ProbeUntrustedFingerprint(ctx context.Context, host string, port int) string {
	rawConn, err := DialTCP(ctx, host, port)
	if err != nil {
		return ""
	}
	defer rawConn.Close()
	_ = rawConn.SetDeadline(time.Now().Add(5 * time.Second))

	var captured string
	cfg := &tls.Config{
		ServerName:         strings.TrimSpace(host),
		MinVersion:         tls.VersionTLS12,
		InsecureSkipVerify: true,
		VerifyPeerCertificate: func(rawCerts [][]byte, _ [][]*x509.Certificate) error {
			if len(rawCerts) > 0 {
				sum := sha256.Sum256(rawCerts[0])
				captured = hex.EncodeToString(sum[:])
			}
			return nil
		},
	}
	tConn := tls.Client(rawConn, cfg)
	_ = tConn.HandshakeContext(ctx)
	_ = tConn.Close()
	return captured
}

func IsCertVerifyError(err error) bool {
	if err == nil {
		return false
	}
	var ua x509.UnknownAuthorityError
	var hn x509.HostnameError
	var ci x509.CertificateInvalidError
	if errors.As(err, &ua) || errors.As(err, &hn) || errors.As(err, &ci) {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "x509:") || strings.Contains(msg, "certificate")
}
