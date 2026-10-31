package service

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"strings"
	"testing"
)

type mailboxDiagnosticFailure struct {
	diagnosticFailure
	response, mailboxClass string
}

func (e mailboxDiagnosticFailure) ResponseCode() string { return e.response }
func (e mailboxDiagnosticFailure) MailboxClass() string { return e.mailboxClass }

func TestSyncSelectDiagnosticDoesNotExposePrivateLabels(t *testing.T) {
	for _, test := range []struct {
		provider, response, class, wantProvider, wantResponse, wantClass string
	}{
		{"gmail", "NONEXISTENT", "gmail_container", "gmail", "NONEXISTENT", "gmail_container"},
		{"custom", "none", "other", "custom", "none", "other"},
		{"PRIVATE_PROVIDER", "PRIVATE_RESPONSE", "PRIVATE_CLASS", "unknown", "unknown", "unknown"},
	} {
		t.Run(test.provider, func(t *testing.T) {
			mail, _, _, _ := testService(t)
			var output bytes.Buffer
			mail.log = slog.New(slog.NewJSONHandler(&output, nil))
			err := syncStepError("select", "other", mailboxDiagnosticFailure{
				diagnosticFailure: diagnosticFailure{code: "command_no"}, response: test.response, mailboxClass: test.class,
			})
			mail.logSyncFailure(err, test.provider)
			var event struct {
				Provider string `json:"provider"`
				Response string `json:"response_code"`
				Class    string `json:"mailbox_class"`
			}
			if err := json.Unmarshal(bytes.TrimSpace(output.Bytes()), &event); err != nil {
				t.Fatal("无法读取安全同步诊断")
			}
			if event.Provider != test.wantProvider || event.Response != test.wantResponse || event.Class != test.wantClass {
				t.Fatal("同步诊断丢失元数据或没有按白名单过滤")
			}
			if strings.Contains(output.String(), "PRIVATE") {
				t.Fatal("同步诊断泄漏动态标签")
			}
		})
	}
}
