package platform

import (
	"bytes"
	"context"
	"crypto/rand"
	"errors"
	"os"
	"testing"

	"github.com/zalando/go-keyring"
)

func TestCredentialValidationAndErrors(t *testing.T) {
	calls := 0
	store := &Credentials{keyringBackend{
		set:    func(_, _, _ string) error { calls++; return errors.New("must-not-leak-secret") },
		get:    func(_, _ string) (string, error) { calls++; return "", keyring.ErrNotFound },
		delete: func(_, _ string) error { calls++; return keyring.ErrNotFound },
	}}
	for _, reference := range []string{"", "../outside", "other/account/x", "omnimail/account/bad\n"} {
		if err := store.Set(t.Context(), reference, []byte("test")); !errors.Is(err, ErrCredentialInvalid) {
			t.Fatal("非法引用未被拒绝")
		}
	}
	reference := "omnimail/account/test/imap"
	if err := store.Set(t.Context(), reference, make([]byte, 2049)); !errors.Is(err, ErrCredentialInvalid) || calls != 0 {
		t.Fatal("超限输入调用了底层")
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if err := store.Set(ctx, reference, []byte("test")); !errors.Is(err, context.Canceled) || calls != 0 {
		t.Fatal("取消后调用了底层")
	}
	if err := store.Set(t.Context(), reference, []byte("test")); err != ErrCredentialUnavailable {
		t.Fatal("错误未安全映射")
	}
	if _, err := store.Get(t.Context(), reference); !errors.Is(err, ErrCredentialMissing) {
		t.Fatal("未区分缺失条目")
	}
	if err := store.Delete(t.Context(), reference); err != nil {
		t.Fatal("删除缺失条目不幂等")
	}
}

func TestNativeCredentialsRoundTrip(t *testing.T) {
	if os.Getenv("OMNIMAIL_TEST_NATIVE_KEYRING") != "1" {
		t.Skip("原生条目测试需显式开启，只操作随机临时条目")
	}
	store := NewCredentials()
	reference := "omnimail/account/" + rand.Text() + "/imap"
	secret := []byte(rand.Text())
	t.Cleanup(func() {
		if err := store.Delete(context.Background(), reference); err != nil {
			t.Error(err)
		}
	})
	if err := store.Set(t.Context(), reference, secret); err != nil {
		t.Fatal(err)
	}
	got, err := store.Get(t.Context(), reference)
	if err != nil || !bytes.Equal(got, secret) {
		t.Fatal("原生凭据往返失败")
	}
	if err := store.Delete(t.Context(), reference); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Get(t.Context(), reference); !errors.Is(err, ErrCredentialMissing) {
		t.Fatal("原生条目未删除")
	}
}
