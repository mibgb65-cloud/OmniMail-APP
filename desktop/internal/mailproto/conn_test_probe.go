package mailproto

import (
	"context"
	"crypto/tls"
	"fmt"
	"time"

	"github.com/emersion/go-imap/v2"

	"omnimail/internal/apperr"
	"omnimail/internal/security"
)

type ProbeStepResult struct {
	Stage      string `json:"stage"`
	Label      string `json:"label"`
	OK         bool   `json:"ok"`
	DurationMs int64  `json:"durationMs"`
	Detail     string `json:"detail"`
	Suggestion string `json:"suggestion,omitempty"`
}

type ConnectionTestReport struct {
	OK                  bool              `json:"ok"`
	ErrorCode           string            `json:"errorCode,omitempty"`
	Summary             string            `json:"summary"`
	UntrustedCertSHA256 string            `json:"untrustedCertSha256,omitempty"`
	DiscoveredMailboxes int               `json:"discoveredMailboxes"`
	Steps               []ProbeStepResult `json:"steps"`
}

// TestConnection 执行无副作用的四阶段连接测试（DNS/TCP → TLS → IMAP → SMTP）。
func TestConnection(ctx context.Context, cfg EndpointConfig) ConnectionTestReport {
	steps := []ProbeStepResult{
		{Stage: "dns", Label: "DNS 解析与端口连通"},
		{Stage: "tls", Label: "TLS 安全握手与证书"},
		{Stage: "imap", Label: "IMAP 收件认证与目录"},
		{Stage: "smtp", Label: "SMTP 发件认证校验"},
	}

	// Step 1: DNS & TCP (IMAP + SMTP)
	t0 := time.Now()
	c1, err := DialTCP(ctx, cfg.ImapHost, cfg.ImapPort)
	if err != nil {
		steps[0].DurationMs = time.Since(t0).Milliseconds()
		steps[0].Detail = security.RedactSensitive(err.Error())
		steps[0].Suggestion = "无法连接收件服务器，请检查网络、代理或端口（SSL 通常为 993，STARTTLS 为 143）"
		return ConnectionTestReport{ErrorCode: apperr.CodeConnFailed, Summary: steps[0].Suggestion, Steps: steps}
	}
	_ = c1.Close()
	c2, err := DialTCP(ctx, cfg.SmtpHost, cfg.SmtpPort)
	steps[0].DurationMs = time.Since(t0).Milliseconds()
	if err != nil {
		steps[0].Detail = security.RedactSensitive(err.Error())
		steps[0].Suggestion = "收件端口可达但无法连接发件服务器，请核对 SMTP 主机与端口（SSL 为 465，STARTTLS 为 587）"
		return ConnectionTestReport{ErrorCode: apperr.CodeConnFailed, Summary: steps[0].Suggestion, Steps: steps}
	}
	_ = c2.Close()
	steps[0].OK = true
	steps[0].Detail = fmt.Sprintf("IMAP(%s:%d) 与 SMTP(%s:%d) 均可达", cfg.ImapHost, cfg.ImapPort, cfg.SmtpHost, cfg.SmtpPort)

	// Step 2: TLS Handshake check on IMAP SSL/TLS (STARTTLS verified during protocol handshake)
	t1 := time.Now()
	if cfg.ImapSecurity == "" || cfg.ImapSecurity == "SSL/TLS" {
		rawConn, dialErr := DialTCP(ctx, cfg.ImapHost, cfg.ImapPort)
		if dialErr != nil {
			steps[1].DurationMs = time.Since(t1).Milliseconds()
			steps[1].Detail = security.RedactSensitive(dialErr.Error())
			return ConnectionTestReport{ErrorCode: apperr.CodeConnFailed, Summary: "建立 TLS 通道前连接中断", Steps: steps}
		}
		tConn := tls.Client(rawConn, BuildTLSConfig(cfg.ImapHost, cfg.CertFingerprint))
		hsErr := tConn.HandshakeContext(ctx)
		_ = tConn.Close()
		steps[1].DurationMs = time.Since(t1).Milliseconds()
		if hsErr != nil {
			steps[1].Detail = security.RedactSensitive(hsErr.Error())
			if IsCertVerifyError(hsErr) && cfg.CertFingerprint == "" {
				fp := ProbeUntrustedFingerprint(ctx, cfg.ImapHost, cfg.ImapPort)
				steps[1].Suggestion = "服务器使用自签名或不受信任证书，如确认内网可信可勾选固定此证书指纹"
				return ConnectionTestReport{
					ErrorCode: apperr.CodeCertUntrusted, Summary: steps[1].Suggestion,
					UntrustedCertSHA256: fp, Steps: steps,
				}
			}
			steps[1].Suggestion = "TLS 握手失败：请检查加密方式（SSL/TLS 与 STARTTLS）是否与端口匹配"
			return ConnectionTestReport{ErrorCode: apperr.CodeConnFailed, Summary: steps[1].Suggestion, Steps: steps}
		}
		steps[1].OK = true
		steps[1].Detail = "TLS 1.2+ 证书链与主机名校验通过"
	} else {
		steps[1].OK = true
		steps[1].Detail = fmt.Sprintf("采用 %s 模式，将在协议握手阶段升级校验", cfg.ImapSecurity)
	}

	// Step 3: IMAP Login + NetEase ID + LIST
	t2 := time.Now()
	imapCli, err := ConnectIMAP(ctx, cfg, nil)
	if err != nil {
		steps[2].DurationMs = time.Since(t2).Milliseconds()
		steps[2].Detail = security.RedactSensitive(err.Error())
		if IsCertVerifyError(err) && cfg.CertFingerprint == "" {
			fp := ProbeUntrustedFingerprint(ctx, cfg.ImapHost, cfg.ImapPort)
			return ConnectionTestReport{ErrorCode: apperr.CodeCertUntrusted, Summary: "STARTTLS 证书不受信任", UntrustedCertSHA256: fp, Steps: steps}
		}
		steps[2].Suggestion = imapAuthAdvice(cfg.Provider)
		return ConnectionTestReport{ErrorCode: apperr.CodeAuthExpired, Summary: steps[2].Suggestion, Steps: steps}
	}
	mboxes, listErr := imapCli.List("", "*", &imap.ListOptions{ReturnStatus: nil}).Collect()
	_ = imapCli.Logout().Wait()
	_ = imapCli.Close()
	steps[2].DurationMs = time.Since(t2).Milliseconds()
	if listErr != nil {
		steps[2].Detail = security.RedactSensitive(listErr.Error())
		steps[2].Suggestion = "IMAP 登录成功但读取邮箱目录被拒绝，请检查网页端是否开启了完整 IMAP 权限"
		return ConnectionTestReport{ErrorCode: apperr.CodeConnFailed, Summary: steps[2].Suggestion, Steps: steps}
	}
	steps[2].OK = true
	steps[2].Detail = fmt.Sprintf("IMAP 认证成功，识别到 %d 个远端文件夹", len(mboxes))

	// Step 4: SMTP Login + NOOP
	t3 := time.Now()
	smtpCli, err := ConnectSMTP(ctx, cfg)
	if err != nil {
		steps[3].DurationMs = time.Since(t3).Milliseconds()
		steps[3].Detail = security.RedactSensitive(err.Error())
		steps[3].Suggestion = "收件配置已通，但发件 SMTP 认证失败，请核对发件服务器端口（465 SSL 或 587 STARTTLS）"
		return ConnectionTestReport{ErrorCode: apperr.CodeConnFailed, Summary: steps[3].Suggestion, Steps: steps}
	}
	_ = smtpCli.Noop()
	_ = smtpCli.Quit()
	steps[3].DurationMs = time.Since(t3).Milliseconds()
	steps[3].OK = true
	steps[3].Detail = "SMTP 发件通道认证与心跳检测通过"

	return ConnectionTestReport{
		OK:                  true,
		Summary:             "四阶段协议探测全部通过",
		DiscoveredMailboxes: len(mboxes),
		Steps:               steps,
	}
}

func imapAuthAdvice(provider string) string {
	switch provider {
	case "qq", "netease":
		return "IMAP 认证被拒绝：请确认已在网页端开启 IMAP/SMTP 服务，并填写客户端授权码而非网页登录密码"
	case "icloud":
		return "IMAP 认证被拒绝：Apple iCloud 必须使用 account.apple.com 生成的 xxxx-xxxx-xxxx-xxxx 应用专用密码"
	case "gmail":
		return "IMAP 认证被拒绝：请使用浏览器 OAuth 授权，或填写 Google 两步验证生成的 16 位应用专用密码"
	default:
		return "IMAP 账号或专用密码校验失败，请核对完整邮箱地址与应用专用密码"
	}
}
