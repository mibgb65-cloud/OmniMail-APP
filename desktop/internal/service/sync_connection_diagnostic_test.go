package service

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"strings"
	"testing"

	"omnimail/desktop/internal/domain"
)

func TestSyncConnectionDiagnosticKeepsSafeTransportMetadata(t *testing.T) {
	mail, _, _, _ := testService(t)
	var output bytes.Buffer
	mail.log = slog.New(slog.NewJSONHandler(&output, nil))
	mail.logSyncFailure(syncStepError("connect", "", &accountDiagnosticError{
		cause: domain.ErrTLS, stage: "tls", reason: "server_closed",
	}), "gmail")
	var event struct {
		Stage  string `json:"connection_stage"`
		Reason string `json:"reason"`
	}
	if err := json.Unmarshal(bytes.TrimSpace(output.Bytes()), &event); err != nil || event.Stage != "tls" || event.Reason != "server_closed" {
		t.Fatal("同步日志丢失 TLS 阶段和安全原因")
	}
	if strings.Contains(output.String(), "PRIVATE") {
		t.Fatal("同步诊断泄漏原始错误")
	}
}
