package service

import (
	"bytes"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
)

type accountDiagnosticError struct {
	cause  error
	stage  string
	reason string
}

func (e *accountDiagnosticError) Error() string           { return "PRIVATE_SERVER_RESPONSE" }
func (e *accountDiagnosticError) Unwrap() error           { return e.cause }
func (e *accountDiagnosticError) ConnectionStage() string { return e.stage }
func (e *accountDiagnosticError) DiagnosticCode() string  { return e.reason }

func TestAccountValidationFailureLogsOnlySafeStageMetadata(t *testing.T) {
	for _, test := range []struct {
		name, protocol, stage, reason, wantStage, wantReason string
		cause                                                error
	}{
		{"imap_dial", "imap", "dial", "connect_failed", "dial", "connect_failed", domain.ErrNetwork},
		{"imap_login", "imap", "authenticate", "server_closed", "authenticate", "server_closed", domain.ErrNetwork},
		{"smtp_auth", "smtp", "authenticate", "server_unavailable", "authenticate", "server_unavailable", domain.ErrNetwork},
		{"smtp_quit", "smtp", "quit", "server_closed", "quit", "server_closed", domain.ErrNetwork},
		{"smtp_tls", "smtp", "tls", "certificate_rejected", "tls", "certificate_rejected", domain.ErrTLS},
		{"imap_rejected", "imap", "authenticate", "server_rejected", "authenticate", "server_rejected", domain.ErrAuthentication},
		{"untrusted_labels", "imap", "PRIVATE_STAGE", "PRIVATE_REASON", "connect", "unknown", domain.ErrNetwork},
	} {
		t.Run(test.name, func(t *testing.T) {
			mail, store, secrets, transport := testService(t)
			var output bytes.Buffer
			mail.log = slog.New(slog.NewJSONHandler(&output, nil))
			failure := &accountDiagnosticError{cause: test.cause, stage: test.stage, reason: test.reason}
			if test.protocol == "imap" {
				transport.authError = failure
			} else {
				transport.smtpError = failure
			}
			if _, err := mail.AddAccount(t.Context(), addInput()); !errors.Is(err, test.cause) {
				t.Fatal("添加失败丢失原始稳定错误类型")
			}
			var event struct {
				Message  string `json:"msg"`
				Protocol string `json:"protocol"`
				Stage    string `json:"stage"`
				Reason   string `json:"reason"`
				Code     string `json:"code"`
			}
			if err := json.Unmarshal(bytes.TrimSpace(output.Bytes()), &event); err != nil {
				t.Fatal("账号验证失败未写入安全阶段日志")
			}
			if event.Message != "账号收发信验证失败" || event.Protocol != test.protocol ||
				event.Stage != test.wantStage || event.Reason != test.wantReason || event.Code != test.cause.Error() {
				t.Fatal("账号验证诊断元数据不匹配")
			}
			for _, private := range []string{"PRIVATE", "person", "example.invalid", "application-code", "password"} {
				if strings.Contains(output.String(), private) {
					t.Fatal("账号验证诊断泄漏了私密内容")
				}
			}
			accounts, err := store.ListAccounts(t.Context())
			if err != nil || len(accounts) != 0 || secrets.sets != 0 {
				t.Fatal("验证失败遗留了账号或凭据")
			}
		})
	}
}
