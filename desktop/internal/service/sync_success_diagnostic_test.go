package service

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"strings"
	"testing"
)

func TestSyncSuccessIdentifiesOnlyAllowlistedProvider(t *testing.T) {
	mail, _, _, _ := testService(t)
	var output bytes.Buffer
	mail.log = slog.New(slog.NewJSONHandler(&output, nil))
	input := addInput()
	input.ProviderCode = "gmail"
	account, err := mail.AddAccount(t.Context(), input)
	if err != nil {
		t.Fatal("无法添加合成测试账号")
	}
	awaitSync(t, mail, account.ID)
	if err := mail.Close(); err != nil {
		t.Fatal("无法结束合成同步")
	}
	var event struct {
		Code     string `json:"code"`
		Provider string `json:"provider"`
	}
	if err := json.Unmarshal(bytes.TrimSpace(output.Bytes()), &event); err != nil {
		t.Fatal("成功同步缺少可解析事件")
	}
	if event.Code != "SYNC_COMPLETE" || event.Provider != "gmail" {
		t.Fatal("成功同步无法区分服务商")
	}
	for _, private := range []string{input.Email, input.IMAP.Username, input.IMAP.Password, account.ID} {
		if strings.Contains(output.String(), private) {
			t.Fatal("同步完成日志泄漏账号或凭据")
		}
	}
}
