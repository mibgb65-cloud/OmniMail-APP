package bridge

import (
	"errors"
	"io"
	"log/slog"
	"testing"

	"omnimail/desktop/internal/repository"
	"omnimail/desktop/internal/service"
)

func TestMailBridgeRejectsInvalidInputWithoutNativeCalls(t *testing.T) {
	store, err := repository.Open(t.Context(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	mail := service.NewMail(store, nil, nil, slog.New(slog.NewTextHandler(io.Discard, nil)))
	t.Cleanup(func() {
		if err := mail.Close(); err != nil {
			t.Error(err)
		}
		if err := store.Close(); err != nil {
			t.Error(err)
		}
	})
	bridge := NewMailBridge(mail, func(string, []byte) (bool, error) { t.Error("非法附件调用了原生保存"); return false, nil })
	if len(bridge.Providers()) < 5 {
		t.Fatal("预设缺失")
	}
	if accounts, err := bridge.Accounts(t.Context()); err != nil || len(accounts) != 0 {
		t.Fatal("空账号列表异常")
	}
	if _, err := bridge.Messages(t.Context(), "../bad", "inbox", 0); err == nil {
		t.Fatal("非法账号未拒绝")
	}
	if _, err := bridge.Message(t.Context(), "../bad"); err == nil {
		t.Fatal("非法邮件未拒绝")
	}
	if _, err := bridge.SaveAttachment(t.Context(), "../bad"); err == nil {
		t.Fatal("非法附件未拒绝")
	}
	if err := bridge.Sync(t.Context(), "../bad"); err == nil {
		t.Fatal("非法同步 ID 未拒绝")
	}
	if err := bridge.Send(t.Context(), service.SendInput{AccountID: "../bad"}); err == nil {
		t.Fatal("非法发送 ID 未拒绝")
	}
	if err := bridge.Disconnect(t.Context(), "../bad"); err == nil {
		t.Fatal("非法断开 ID 未拒绝")
	}
	if err := mailError(errors.New("sensitive diagnostic")); err.Error() != "STORAGE_FAILED" {
		t.Fatal("桥接泄漏诊断内容")
	}
}
