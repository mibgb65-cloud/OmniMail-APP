//go:build !windows

package main

import (
	"context"
	"errors"
)

func showPrivacySystemToast(_ context.Context, _, _ string) error {
	return errors.New("当前系统不支持 OmniMail 的 Windows 桌面通知")
}
