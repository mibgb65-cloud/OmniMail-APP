package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
)

type selectFailureSession struct {
	fakeSession
	cause error
}

type stageFailureSession struct {
	selectFailureSession
	kind  string
	stage string
}

func (s stageFailureSession) Select(name string) (uint32, uint32, error) {
	if s.stage == "fetch_headers" {
		return s.fakeSession.Select(name)
	}
	return s.selectFailureSession.Select(name)
}

func (s stageFailureSession) Headers(uint32, uint32) ([]domain.RemoteMessage, error) {
	return []domain.RemoteMessage{{UID: 1, Subject: "partial fixture"}}, s.cause
}

func (s stageFailureSession) Mailboxes() ([]domain.RemoteMailbox, error) {
	return []domain.RemoteMailbox{{Name: "PRIVATE_MAILBOX", Kind: s.kind}}, nil
}

type stageFailureTransport struct {
	fakeTransport
	cause error
	kind  string
	stage string
}

func (f *stageFailureTransport) Connect(context.Context, domain.AccountEndpoint, []byte) (domain.MailSession, error) {
	return stageFailureSession{selectFailureSession: selectFailureSession{cause: f.cause}, kind: f.kind, stage: f.stage}, nil
}

func TestSyncFailureDiagnosticUsesOnlySafeStageMetadata(t *testing.T) {
	for _, test := range []struct {
		kind, stage, code string
		cause             error
	}{
		{"inbox", "select", "MAIL_PROTOCOL_FAILED", domain.ErrProtocol},
		{"PRIVATE_KIND", "select", "MAIL_PROTOCOL_FAILED", domain.ErrProtocol},
		{"inbox", "fetch_headers", "NETWORK_FAILED", domain.ErrNetwork},
	} {
		t.Run(test.stage+"/"+test.kind, func(t *testing.T) {
			mail, _, _, _ := testService(t)
			mail.transport = &stageFailureTransport{
				kind: test.kind, stage: test.stage, cause: errors.Join(test.cause, errors.New("PRIVATE_SERVER_RESPONSE")),
			}
			var output bytes.Buffer
			mail.log = slog.New(slog.NewJSONHandler(&output, nil))
			account, err := mail.AddAccount(t.Context(), addInput())
			if err != nil {
				t.Fatal("合成账号无法创建")
			}
			awaitSync(t, mail, account.ID)
			expected := test.kind
			if test.kind != "inbox" {
				expected = "unknown"
			}
			assertSyncDiagnostic(t, output.Bytes(), test.code, test.stage, expected)
			messages, err := mail.Messages(t.Context(), account.ID, "inbox", 0)
			if err != nil || len(messages) != 0 {
				t.Fatal("同步失败仍提交了不完整的邮件批次")
			}
		})
	}
}

func assertSyncDiagnostic(t *testing.T, output []byte, code, stage, kind string, reasons ...string) {
	t.Helper()
	var event struct {
		Code   string `json:"code"`
		Stage  string `json:"stage"`
		Kind   string `json:"mailbox_kind"`
		Reason string `json:"reason"`
	}
	if err := json.Unmarshal(bytes.TrimSpace(output), &event); err != nil {
		t.Fatal("同步失败没有可解析的安全阶段诊断")
	}
	if event.Code != code || event.Stage != stage || event.Kind != kind {
		t.Fatalf("阶段诊断元数据不正确：%+v", event)
	}
	reason := "unknown"
	if len(reasons) > 0 {
		reason = reasons[0]
	}
	if event.Reason != reason {
		t.Fatal("诊断原因不正确或未经过白名单")
	}
	if strings.Contains(string(output), "PRIVATE") {
		t.Fatal("诊断泄漏了文件夹或服务器原文")
	}
}

type diagnosticFailure struct{ code string }

func (e diagnosticFailure) Error() string          { return domain.ErrProtocol.Error() }
func (e diagnosticFailure) Unwrap() error          { return domain.ErrProtocol }
func (e diagnosticFailure) DiagnosticCode() string { return e.code }

func TestSyncDiagnosticReasonIsAllowlisted(t *testing.T) {
	for _, reason := range []string{"missing_envelope", "PRIVATE_REASON"} {
		t.Run(reason, func(t *testing.T) {
			mail, _, _, _ := testService(t)
			var output bytes.Buffer
			mail.log = slog.New(slog.NewJSONHandler(&output, nil))
			mail.logSyncFailure(syncStepError("fetch_headers", "inbox", diagnosticFailure{code: reason}))
			expected := reason
			if reason == "PRIVATE_REASON" {
				expected = "unknown"
			}
			assertSyncDiagnostic(t, output.Bytes(), "MAIL_PROTOCOL_FAILED", "fetch_headers", "inbox", expected)
		})
	}
}

func TestSyncFailureDoesNotLogArbitraryStageOrCause(t *testing.T) {
	mail, _, _, _ := testService(t)
	var output bytes.Buffer
	mail.log = slog.New(slog.NewJSONHandler(&output, nil))
	mail.logSyncFailure(syncStepError("PRIVATE_STAGE", "PRIVATE_KIND",
		errors.Join(domain.ErrProtocol, errors.New("PRIVATE_SERVER_RESPONSE"))))
	assertSyncDiagnostic(t, output.Bytes(), "MAIL_PROTOCOL_FAILED", "unknown", "unknown")
}

func (s selectFailureSession) Select(string) (uint32, uint32, error) {
	return 0, 0, s.cause
}

func TestSyncPreservesSelectFailureInsteadOfClaimingInvalidMail(t *testing.T) {
	for _, cause := range []error{domain.ErrNetwork, context.Canceled, context.DeadlineExceeded, domain.ErrAuthentication} {
		t.Run(ErrorCode(cause), func(t *testing.T) {
			mail, _, _, _ := testService(t)
			_, err := mail.syncMailbox(t.Context(), "test-account",
				domain.RemoteMailbox{Name: "INBOX", Kind: "inbox"}, selectFailureSession{cause: cause})
			if !errors.Is(err, cause) {
				t.Fatalf("SELECT 真实错误被覆盖：%v", err)
			}
		})
	}
}
