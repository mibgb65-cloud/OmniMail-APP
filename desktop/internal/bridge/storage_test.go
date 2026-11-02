package bridge

import (
	"context"
	"errors"
	"testing"

	"omnimail/desktop/internal/service"
)

func TestStorageBridgeUsage(t *testing.T) {
	bridge := NewStorageBridge(service.NewStorage(t.TempDir()))
	result, err := bridge.Usage(t.Context())
	if err != nil || result != (service.StorageUsage{}) {
		t.Fatalf("空目录桥接 = %+v, %v", result, err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if _, err := bridge.Usage(ctx); !errors.Is(err, context.Canceled) {
		t.Fatal("桥接应传递取消")
	}
}
