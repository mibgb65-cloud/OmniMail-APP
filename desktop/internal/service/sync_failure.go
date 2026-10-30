package service

import "errors"

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
		"select", "cache_mailbox", "search", "cache_read", "fetch_headers", "cache_headers":
		stage = failure.stage
	}
	switch failure.kind {
	case "inbox", "sent", "drafts", "deleted", "archive", "other":
		kind = failure.kind
	}
	return
}

func (s *Mail) logSyncFailure(err error) {
	if err == nil || s.ctx.Err() != nil || ErrorCode(err) == "CANCELED" {
		return
	}
	stage, kind := safeSyncFailureLabels(err)
	reason := "unknown"
	var diagnostic interface{ DiagnosticCode() string }
	if errors.As(err, &diagnostic) {
		switch code := diagnostic.DiagnosticCode(); code {
		case "command_no", "command_bad", "response_parse", "missing_envelope",
			"uid_out_of_range", "batch_overflow", "unexpected_body", "incomplete_headers":
			reason = code
		}
	}
	// 仅记录白名单语义，不记录 err、账号/文件夹名称、服务器原文或邮件内容。
	s.log.Warn("邮件同步未完成", "code", ErrorCode(err), "stage", stage, "mailbox_kind", kind, "reason", reason)
}
