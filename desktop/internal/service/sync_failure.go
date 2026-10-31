package service

import (
	"errors"

	"omnimail/desktop/internal/domain"
)

type selectionMetadataFailure struct{ reason string }

func (e selectionMetadataFailure) Error() string          { return "MAIL_PROTOCOL_FAILED" }
func (e selectionMetadataFailure) Unwrap() error          { return domain.ErrProtocol }
func (e selectionMetadataFailure) DiagnosticCode() string { return e.reason }

type syncFailure struct {
	stage string
	kind  string
	cause error
}

func (e *syncFailure) Error() string { return ErrorCode(e.cause) }
func (e *syncFailure) Unwrap() error { return e.cause }

func syncStepError(stage, kind string, err error) error {
	if err == nil {
		return nil
	}
	return &syncFailure{stage: stage, kind: kind, cause: err}
}

func syncMailboxError(kind string, err error) error {
	if err == nil {
		return nil
	}
	stage, _ := safeSyncFailureLabels(err)
	return syncStepError(stage, kind, err)
}

func safeSyncFailureLabels(err error) (stage, kind string) {
	stage, kind = "unknown", "unknown"
	var failure *syncFailure
	if !errors.As(err, &failure) {
		return
	}
	switch failure.stage {
	case "wait_connection", "load_account", "load_endpoint", "load_credential", "connect", "list",
		"select", "cache_mailbox", "search", "cache_read", "fetch_headers", "cache_headers",
		"load_body_backlog", "persist_body", "reconcile_body":
		stage = failure.stage
	}
	switch failure.kind {
	case "inbox", "sent", "drafts", "deleted", "archive", "other":
		kind = failure.kind
	}
	return
}

func (s *Mail) logSyncFailure(err error, providers ...string) {
	if err == nil || s.ctx.Err() != nil || ErrorCode(err) == "CANCELED" {
		return
	}
	stage, kind := safeSyncFailureLabels(err)
	reason := "unknown"
	var diagnostic interface{ DiagnosticCode() string }
	if errors.As(err, &diagnostic) {
		switch code := diagnostic.DiagnosticCode(); code {
		case "command_no", "command_bad", "response_parse", "missing_envelope",
			"uid_out_of_range", "batch_overflow", "unexpected_body", "incomplete_headers",
			"missing_uidvalidity", "missing_uidnext", "uidvalidity_changed",
			"mime_header_invalid", "mime_part_invalid", "mime_text_read_failed",
			"mime_charset_unknown", "mime_encoding_unknown", "server_closed",
			"mime_base64_invalid", "mime_body_truncated", "mime_quoted_printable_invalid",
			"mime_base64_truncated", "mime_quoted_printable_truncated",
			"certificate_rejected", "dns_failed", "connect_failed", "io_failed",
			"timeout", "server_unavailable", "server_rejected":
			reason = code
		}
	}
	provider := "unknown"
	if len(providers) > 0 {
		provider = safeSyncProvider(providers[0])
	}
	response, mailboxClass := safeMailboxDiagnostic(err)
	connectionStage := "unknown"
	var connection interface{ ConnectionStage() string }
	if errors.As(err, &connection) {
		switch value := connection.ConnectionStage(); value {
		case "dial", "tls", "starttls", "greeting", "identify", "authenticate", "quit":
			connectionStage = value
		}
	}
	// 仅记录白名单语义，不记录 err、账号/文件夹名称、服务器原文或邮件内容。
	s.log.Warn("邮件同步未完成", "code", ErrorCode(err), "stage", stage, "mailbox_kind", kind, "reason", reason,
		"provider", provider, "response_code", response, "mailbox_class", mailboxClass, "connection_stage", connectionStage)
}

func safeSyncProvider(provider string) string {
	switch provider {
	case "gmail", "qq", "netease_163", "netease_126", "linuxdo", "custom":
		return provider
	default:
		return "unknown"
	}
}

func safeMailboxDiagnostic(err error) (response, mailboxClass string) {
	response, mailboxClass = "unknown", "unknown"
	var diagnostic interface {
		ResponseCode() string
		MailboxClass() string
	}
	if !errors.As(err, &diagnostic) {
		return
	}
	switch code := diagnostic.ResponseCode(); code {
	case "none", "NONEXISTENT", "NOPERM", "CANNOT", "LIMIT", "INUSE", "SERVERBUG", "CLIENTBUG", "TRYCREATE":
		response = code
	}
	switch value := diagnostic.MailboxClass(); value {
	case "inbox", "gmail_container", "gmail_system", "other":
		mailboxClass = value
	}
	return
}
