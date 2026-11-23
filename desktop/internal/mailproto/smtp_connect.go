package mailproto

import (
	"context"
	"crypto/tls"
	"strings"
	"time"

	"github.com/emersion/go-sasl"
	"github.com/emersion/go-smtp"
)

// ConnectSMTP 建立经过 TLS 校验与 SASL 认证（自动协商 PLAIN / LOGIN / XOAUTH2）的 SMTP 客户端。
func ConnectSMTP(ctx context.Context, cfg EndpointConfig) (*smtp.Client, error) {
	rawConn, err := DialTCP(ctx, cfg.SmtpHost, cfg.SmtpPort)
	if err != nil {
		return nil, err
	}
	tlsCfg := BuildTLSConfig(cfg.SmtpHost, cfg.CertFingerprint)

	sec := strings.ToUpper(strings.TrimSpace(cfg.SmtpSecurity))
	if sec == "" {
		if cfg.SmtpPort == 587 || cfg.SmtpPort == 25 {
			sec = "STARTTLS"
		} else {
			sec = "SSL/TLS"
		}
	}

	var client *smtp.Client
	switch sec {
	case "SSL/TLS":
		tConn := tls.Client(rawConn, tlsCfg)
		if err := tConn.HandshakeContext(ctx); err != nil {
			_ = rawConn.Close()
			return nil, err
		}
		client = smtp.NewClient(tConn)
	case "STARTTLS":
		c, err := smtp.NewClientStartTLS(rawConn, tlsCfg)
		if err != nil {
			_ = rawConn.Close()
			return nil, err
		}
		client = c
	default:
		client = smtp.NewClient(rawConn)
	}

	client.CommandTimeout = 20 * time.Second
	client.SubmissionTimeout = 60 * time.Second

	if sec != "STARTTLS" {
		if err := client.Hello("omnimail.local"); err != nil {
			_ = client.Close()
			return nil, err
		}
	}

	user := cfg.LoginUser()
	secret := NormalizeAccountSecret(cfg.Provider, cfg.Email, cfg.Secret)
	if cfg.AuthMode == "oauth" {
		if err := client.Auth(NewXOAuth2Client(user, strings.TrimSpace(cfg.Secret))); err != nil {
			_ = client.Close()
			return nil, err
		}
		return client, nil
	}

	if client.SupportsAuth(sasl.Plain) {
		err := client.Auth(sasl.NewPlainClient("", user, secret))
		if err == nil {
			return client, nil
		}
		if client.SupportsAuth(sasl.Login) {
			if loginErr := client.Auth(sasl.NewLoginClient(user, secret)); loginErr == nil {
				return client, nil
			}
		}
		_ = client.Close()
		return nil, err
	}
	if client.SupportsAuth(sasl.Login) {
		if err := client.Auth(sasl.NewLoginClient(user, secret)); err != nil {
			_ = client.Close()
			return nil, err
		}
		return client, nil
	}
	if err := client.Auth(sasl.NewPlainClient("", user, secret)); err != nil {
		_ = client.Close()
		return nil, err
	}
	return client, nil
}
