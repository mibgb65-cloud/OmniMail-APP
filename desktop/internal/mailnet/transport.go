package mailnet

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"log/slog"
	"mime"
	"net"
	"net/smtp"
	"strconv"
	"sync"
	"time"

	"omnimail/desktop/internal/domain"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"
	"github.com/emersion/go-message/charset"
)

type Transport struct{ roots *x509.CertPool }

func New() *Transport { return &Transport{} }

type limitedConn struct {
	net.Conn
	remaining int64
	failureMu sync.Mutex
	readError error
}

func (c *limitedConn) Read(buffer []byte) (int, error) {
	if c.remaining <= 0 {
		c.recordReadError(domain.ErrTooLarge)
		return 0, domain.ErrTooLarge
	}
	if int64(len(buffer)) > c.remaining {
		buffer = buffer[:c.remaining]
	}
	n, err := c.Conn.Read(buffer)
	c.remaining -= int64(n)
	if err != nil {
		c.recordReadError(err)
	}
	return n, err
}

func (c *limitedConn) recordReadError(err error) {
	c.failureMu.Lock()
	defer c.failureMu.Unlock()
	if c.readError == nil {
		c.readError = err
	}
}

func (c *limitedConn) failure() error {
	c.failureMu.Lock()
	defer c.failureMu.Unlock()
	return c.readError
}
func releaseConnection(conn net.Conn) {
	if err := conn.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
		slog.Warn("邮件连接清理失败", "code", "NETWORK_FAILED")
	}
}
func closeIMAP(c *imapclient.Client) {
	if err := c.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
		slog.Warn("IMAP 连接清理失败", "code", "NETWORK_FAILED")
	}
}

func (t *Transport) dial(ctx context.Context, endpoint domain.AccountEndpoint) (net.Conn, func() bool, error) {
	if ctx.Err() != nil {
		return nil, nil, connectionStepError("dial", ctx.Err(), ctx.Err())
	}
	conn, err := (&net.Dialer{Timeout: 10 * time.Second}).DialContext(ctx, "tcp",
		net.JoinHostPort(endpoint.Host, strconv.Itoa(endpoint.Port)))
	if err != nil {
		if ctx.Err() != nil {
			return nil, nil, connectionStepError("dial", ctx.Err(), ctx.Err())
		}
		return nil, nil, connectionStepError("dial", domain.ErrNetwork, err)
	}
	// 总读取预算同时约束伪造的大 envelope 和字符串，不只限制正常正文 literal。
	conn = &limitedConn{Conn: conn, remaining: 64 << 20}
	stop := context.AfterFunc(ctx, func() { releaseConnection(conn) })
	deadline := time.Now().Add(60 * time.Second)
	if requested, ok := ctx.Deadline(); ok && requested.Before(deadline) {
		deadline = requested
	}
	if err := conn.SetDeadline(deadline); err != nil {
		stop()
		releaseConnection(conn)
		return nil, nil, connectionStepError("dial", domain.ErrNetwork, err)
	}
	if endpoint.TLSMode == domain.TLSImplicit {
		secure := tls.Client(conn, t.tlsConfig(endpoint.Host))
		if err := secure.HandshakeContext(ctx); err != nil {
			stop()
			releaseConnection(conn)
			if ctx.Err() != nil {
				return nil, nil, connectionStepError("tls", ctx.Err(), ctx.Err())
			}
			return nil, nil, connectionStepError("tls", domain.ErrTLS, err)
		}
		return secure, stop, nil
	}
	if endpoint.TLSMode != domain.TLSStartTLS {
		stop()
		releaseConnection(conn)
		return nil, nil, connectionStepError("tls", domain.ErrTLS, domain.ErrTLS)
	}
	return conn, stop, nil
}

func (t *Transport) tlsConfig(host string) *tls.Config {
	return &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12, RootCAs: t.roots}
}

func (t *Transport) Connect(ctx context.Context, endpoint domain.AccountEndpoint, secret []byte) (domain.MailSession, error) {
	if endpoint.AuthKind != domain.AuthPassword {
		return nil, domain.ErrOAuthConfig
	}
	conn, stop, err := t.dial(ctx, endpoint)
	if err != nil {
		return nil, err
	}
	options := &imapclient.Options{TLSConfig: t.tlsConfig(endpoint.Host), WordDecoder: &mime.WordDecoder{CharsetReader: charset.Reader}}
	var c *imapclient.Client
	if endpoint.TLSMode == domain.TLSStartTLS {
		c, err = imapclient.NewStartTLS(conn, options)
	} else {
		c = imapclient.New(conn, options)
	}
	stage := "starttls"
	if err == nil {
		stage = "greeting"
		err = c.WaitGreeting()
	}
	if err != nil {
		stop()
		releaseConnection(conn)
		if ctx.Err() != nil {
			return nil, connectionStepError(stage, ctx.Err(), ctx.Err())
		}
		return nil, connectionStepError(stage, domain.ErrTLS, err)
	}
	// 部分服务商要求 IMAP ID；只发送应用标识，不发送系统信息、账号或环境变量。
	if c.Caps().Has(imap.CapID) {
		if _, err := c.ID(&imap.IDData{Name: "OmniMail", Version: "0.1.0"}).Wait(); err != nil {
			stop()
			closeIMAP(c)
			return nil, connectionStepError("identify", domain.ErrProtocol, err)
		}
	}
	if err := c.Login(endpoint.Username, string(secret)).Wait(); err != nil {
		failure := authenticationError(ctx, conn, err)
		stop()
		releaseConnection(conn)
		return nil, connectionStepError("authenticate", failure, err)
	}
	return &session{client: c, stop: stop, ctx: ctx, conn: conn}, nil
}

func (t *Transport) smtp(ctx context.Context, endpoint domain.AccountEndpoint, secret []byte) (*smtp.Client, func(), error) {
	if endpoint.AuthKind != domain.AuthPassword {
		return nil, nil, domain.ErrOAuthConfig
	}
	conn, stop, err := t.dial(ctx, endpoint)
	if err != nil {
		return nil, nil, err
	}
	closeConnection := func() { stop(); releaseConnection(conn) }
	c, err := smtp.NewClient(conn, endpoint.Host)
	if err != nil {
		closeConnection()
		return nil, nil, connectionStepError("greeting", domain.ErrNetwork, err)
	}
	if endpoint.TLSMode == domain.TLSStartTLS {
		if err := c.StartTLS(t.tlsConfig(endpoint.Host)); err != nil {
			closeConnection()
			return nil, nil, connectionStepError("starttls", domain.ErrTLS, err)
		}
	}
	if err := c.Auth(smtp.PlainAuth("", endpoint.Username, string(secret), endpoint.Host)); err != nil {
		failure := authenticationError(ctx, conn, err)
		closeConnection()
		return nil, nil, connectionStepError("authenticate", failure, err)
	}
	return c, closeConnection, nil
}

func (t *Transport) CheckSMTP(ctx context.Context, endpoint domain.AccountEndpoint, secret []byte) error {
	c, closeConnection, err := t.smtp(ctx, endpoint, secret)
	if err != nil {
		return err
	}
	defer closeConnection()
	if err := c.Quit(); err != nil {
		if ctx.Err() != nil {
			return connectionStepError("quit", ctx.Err(), ctx.Err())
		}
		// SMTP AUTH 已成功，QUIT 仅用于礼貌退出；退出失败不能把有效账号误报成认证失败。
		slog.Warn("SMTP 认证已通过，退出连接失败", "code", "NETWORK_FAILED", "stage", "quit", "reason", connectionFailureReason(err))
	}
	return ctx.Err()
}

func (t *Transport) Send(ctx context.Context, endpoint domain.AccountEndpoint, secret []byte,
	from string, recipients []string, message []byte) error {
	c, closeConnection, err := t.smtp(ctx, endpoint, secret)
	if err != nil {
		return err
	}
	defer closeConnection()
	if err := c.Mail(from); err != nil {
		return domain.ErrProtocol
	}
	for _, recipient := range recipients {
		if err := c.Rcpt(recipient); err != nil {
			return domain.ErrProtocol
		}
	}
	writer, err := c.Data()
	if err != nil {
		return domain.ErrProtocol
	}
	if _, err := writer.Write(message); err != nil {
		return domain.ErrSendUncertain
	}
	if err := writer.Close(); err != nil {
		return domain.ErrSendUncertain
	}
	// DATA 已获成功确认；QUIT 失败不得诱导用户重发，底层连接由 defer 关闭。
	if err := c.Quit(); err != nil {
		return nil
	}
	return nil
}
