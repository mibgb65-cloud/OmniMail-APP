package service

import "errors"

func (s *Mail) logAccountValidationFailure(protocol, fallbackStage string, err error) {
	stage, reason := fallbackStage, "unknown"
	var diagnostic interface {
		ConnectionStage() string
		DiagnosticCode() string
	}
	if errors.As(err, &diagnostic) {
		switch value := diagnostic.ConnectionStage(); value {
		case "dial", "tls", "starttls", "greeting", "identify", "authenticate", "quit":
			stage = value
		}
		switch value := diagnostic.DiagnosticCode(); value {
		case "canceled", "timeout", "server_closed", "certificate_rejected", "dns_failed",
			"connect_failed", "io_failed", "server_unavailable", "server_rejected":
			reason = value
		}
	}
	// 即使协议适配器提供诊断，也不信任其动态标签，更不记录 err 或账号/服务器字段。
	s.log.Warn("账号收发信验证失败", "protocol", protocol, "stage", stage, "reason", reason, "code", ErrorCode(err))
}
