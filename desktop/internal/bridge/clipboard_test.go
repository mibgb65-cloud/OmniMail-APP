package bridge

import (
	"context"
	"strings"
	"testing"
)

func TestCopyMailAddressesRequiresValidInputAndNativeSuccess(t *testing.T) {
	var saved string
	calls := 0
	b := NewAppBridge(func(text string) bool { calls++; saved = text; return true })
	if err := b.CopyMailAddresses(t.Context(), "one@example.invalid, Two@example.invalid"); err != nil {
		t.Fatal(err)
	}
	if calls != 1 || saved != "one@example.invalid, Two@example.invalid" {
		t.Fatal("写入内容或次数不符")
	}
	for _, input := range []string{"", "not an address", "a@example.invalid\nx", "Name <a@example.invalid>", strings.Repeat("x", 4097)} {
		if err := b.CopyMailAddresses(t.Context(), input); err == nil {
			t.Fatal("无效地址触发复制")
		}
	}
	if calls != 1 {
		t.Fatal("无效输入调用了原生能力")
	}
	failed := NewAppBridge(func(string) bool { return false })
	if err := failed.CopyMailAddresses(t.Context(), "one@example.invalid"); err == nil || err.Error() != "COPY_UNAVAILABLE" {
		t.Fatal("原生失败被错误声明为已复制")
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if err := b.CopyMailAddresses(ctx, "one@example.invalid"); err == nil {
		t.Fatal("取消后仍写剪贴板")
	}
}
