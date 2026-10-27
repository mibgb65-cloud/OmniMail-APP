package bridge

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

func TestVersion(t *testing.T) {
	info, err := NewAppBridge().Version(context.Background())
	if err != nil || info.Version == "" || info.GoVersion == "" || info.Platform == "" {
		t.Fatalf("版本信息无效: %+v, %v", info, err)
	}
	data, err := json.Marshal(info)
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]string
	if err := json.Unmarshal(data, &fields); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"version", "commit", "buildTime", "goVersion", "platform"} {
		if fields[key] == "" {
			t.Errorf("绑定 DTO 缺少字段 %s", key)
		}
	}
}

func TestVersionCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := NewAppBridge().Version(ctx)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("取消错误 = %v", err)
	}
}
