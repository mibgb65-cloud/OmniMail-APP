package mailproto

import (
	"context"
	"crypto/tls"
	"net"
	"strings"
	"time"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"
	"github.com/emersion/go-sasl"
)

type EndpointConfig struct {
	Provider        string `json:"provider"`
	Email           string `json:"email"`
	Username        string `json:"username"`
	AuthMode        string `json:"authMode"`
	Secret          string `json:"secret"`
	ImapHost        string `json:"imapHost"`
	ImapPort        int    `json:"imapPort"`
	ImapSecurity    string `json:"imapSecurity"`
	SmtpHost        string `json:"smtpHost"`
	SmtpPort        int    `json:"smtpPort"`
	SmtpSecurity    string `json:"smtpSecurity"`
	CertFingerprint string `json:"certFingerprint"`
}

func (c EndpointConfig) LoginUser() string {
	if u := strings.TrimSpace(c.Username); u != "" {
		return u
	}
	return strings.TrimSpace(c.Email)
}

// ConnectIMAP 建立经过 TLS 校验与身份认证的 IMAP v2 客户端（自动发送网易 RFC2971 ID）。
func ConnectIMAP(ctx context.Context, cfg EndpointConfig, unilateral *imapclient.UnilateralDataHandler) (*imapclient.Client, error) {
	rawConn, err := DialTCP(ctx, cfg.ImapHost, cfg.ImapPort)
	if err != nil {
		return nil, err
	}
	tlsCfg := BuildTLSConfig(cfg.ImapHost, cfg.CertFingerprint)
	opts := &imapclient.Options{
		TLSConfig:             tlsCfg,
		WordDecoder:           NewMIMEWordDecoder(),
		UnilateralDataHandler: unilateral,
	}

	sec := strings.ToUpper(strings.TrimSpace(cfg.ImapSecurity))
	if sec == "" {
		if cfg.ImapPort == 143 {
			sec = "STARTTLS"
		} else {
			sec = "SSL/TLS"
		}
	}

	var client *imapclient.Client
	var baseConn net.Conn = rawConn
	switch sec {
	case "SSL/TLS":
		tConn := tls.Client(rawConn, tlsCfg)
		if err := tConn.HandshakeContext(ctx); err != nil {
			_ = rawConn.Close()
			return nil, err
		}
		baseConn = tConn
		client = imapclient.New(tConn, opts)
		_ = baseConn.SetDeadline(time.Now().Add(15 * time.Second))
		if err := client.WaitGreeting(); err != nil {
			_ = client.Close()
			return nil, err
		}
	case "STARTTLS":
		_ = baseConn.SetDeadline(time.Now().Add(15 * time.Second))
		c, err := imapclient.NewStartTLS(rawConn, opts)
		if err != nil {
			_ = rawConn.Close()
			return nil, err
		}
		client = c
	default:
		client = imapclient.New(rawConn, opts)
		_ = baseConn.SetDeadline(time.Now().Add(15 * time.Second))
		if err := client.WaitGreeting(); err != nil {
			_ = client.Close()
			return nil, err
		}
	}

	user := cfg.LoginUser()
	secret := NormalizeAccountSecret(cfg.Provider, cfg.Email, cfg.Secret)
	if cfg.AuthMode == "oauth" {
		if err := client.Authenticate(NewXOAuth2Client(user, strings.TrimSpace(cfg.Secret))); err != nil {
			_ = client.Close()
			return nil, err
		}
	} else {
		if err := client.Login(user, secret).Wait(); err != nil {
			if plainErr := client.Authenticate(sasl.NewPlainClient("", user, secret)); plainErr != nil {
				_ = client.Close()
				return nil, err
			}
		}
	}

	if ShouldSendIMAPID(cfg.Provider, cfg.ImapHost) || client.Caps().Has(imap.CapID) {
		_, _ = client.ID(&imap.IDData{
			Name:       "OmniMail",
			Version:    "0.1.0",
			Vendor:     "OmniMail Desktop",
			SupportURL: "https://omnimail.local",
		}).Wait()
	}

	_ = baseConn.SetDeadline(time.Time{})
	return client, nil
}
