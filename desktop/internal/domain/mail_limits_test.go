package domain

import (
	"errors"
	"fmt"
	"testing"
)

func TestMessageLimitClassificationDoesNotSwallowOtherFailures(t *testing.T) {
	if MessageLimitCode(fmt.Errorf("wrapped: %w", ErrAttachmentTooLarge)) != "ATTACHMENT_TOO_LARGE" {
		t.Fatal("确定的单封限额被丢失")
	}
	for _, err := range []error{ErrTooLarge, ErrNetwork, errors.Join(ErrAttachmentTooLarge, errors.New("STORAGE_FAILED"))} {
		if MessageLimitCode(err) != "" {
			t.Fatal("通用预算/混合失败被误当成可永久排除的单封限额")
		}
	}
}
